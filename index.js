var _ = require('lodash');
var async = require('async-chainable');
var asyncCartesian = require('async-chainable-cartesian');
var compareNames = require('compare-names');
var events = require('events');
var natural = require('natural');
var util = require('util');
var reflibUtils = require('reflib-utils');

function SRADedupe(settings) {
	var dedupe = this;

	dedupe.settings = _.defaults(settings, {
		regexps: {
			alphaNumeric: /[^a-z0-9]+/g,
			junkWords: /\b(the|a)\b/g,
			looksNumeric: /^[0-9\.\-]+$/,
			looksNumericWhitespace: /^\s*[0-9\.\-]+\s*$/,
			onlyNumeric: /[^0-9]+/g,
		},
		stringDistances: {
			jaroWinklerMin: 0.9, // natural.JaroWinklerDistance
			levenshteinMax: 10, // natural.LevenshteinDistance
		},
		compareAll: {
			threadLimit: 50, // How many parallel threads to allow when comparing
			progressThrottle: 100, // Throttle progress reporting to this value
		},
		match: {
			isbn: true,		// Turn off ISBN matching, if you find it creates false positives e.g. with collected works.
			doi: true,		// Turn off DOI matching, similar to ISBN
		},
	});


	/**
	* Returns the number version of the given value or false if it cannot be converted
	* @param {string|number} val The incomming value
	* @param {number|boolean} Either the converted value of false if it is not numeric
	*/
	dedupe.getNumeric = function(val) {
		if (_.isNumber(val)) return val;
		if (dedupe.settings.regexps.looksNumeric.test(val)) return parseInt(val.replace(dedupe.settings.regexps.onlyNumeric, ''));

		return false;
	};

	/**
	* Examine two inputs and decide if they are duplicate references
	* @param {Object} ref1 The first reference to compare
	* @param {Object} ref2 The second reference to compare
	* @return {Object} An object with the keys `isDupe` (boolean), `reason` (string)
	* @return {boolean|string} Either false if the references are not duplicates or truey value string explaining the reason they are
	*/
	dedupe.compare = function(ref1, ref2) {
		// Stage 1 - Very basic sanity checks - do not match if title is absent on either side {{{
		if (!ref1.title || !ref2.title) return {isDupe: false, reason: 'missing title'};
		// }}}

		// Stage 2 - Basic sanity checks - do not match if year, page, volume, isbn or number is present BUT mismatch exactly {{{
		// Since these fields are usually numeric its fairly likely that if these dont match its not a duplicate
		var mismatchedField = ['year', 'pages', 'volume', 'number', 'isbn'].find(function(f) { // Find the first mismatched (but important) field
			if (ref1[f] && ref2[f]) { // Both refs possess the comparitor
				var ref1n = dedupe.getNumeric(ref1[f]);
				var ref2n = dedupe.getNumeric(ref2[f]);
				if (ref1n === false || ref2n === false) return false; // One side isn't comparable

				return (ref1n != ref2n);
			}
		});
		if (mismatchedField) return {isDupe: false, reason: mismatchedField};
		// }}}

		// Stage 3 - Extract DOIs from both sides and compare {{{
		if(dedupe.settings.match.doi){
			var ref1DOI = reflibUtils.getDOI(ref1);
			var ref2DOI = reflibUtils.getDOI(ref2);
			if (ref1DOI && ref2DOI) return {isDupe: ref1DOI == ref2DOI, reason: 'doi'}; // Both have a DOI so we can be definitive
		}
		// }}}

		// Stage 4 - Extraction of years from titles + comparison {{{
		// Extract an array of years from each title and check that ref2 contains the same years if the years mismatch its not a dupe
		var ref1Years = ref1.title.match(/\b([0-9]{4})\b/g) || [];
		var ref2Years = ref2.title.match(/\b([0-9]{4})\b/g) || [];
		if (
			(ref1Years.length || ref2Years.length) && // At least one has a year set
			_.intersection(ref1Years, ref2Years).length != _.max([ref1Years.length, ref2Years.length])
		) return {isDupe: false, reason: 'year'};
		// }}}

		// NOTE: Because ISBN is the same between journals this feature has been removed
		// Stage 5 - Extract numbers from ISBNs on either side and compare {{{
		// This comparison only works if each side has a 'perfect' ISBN - i.e. /^\s*[0-9\.\-\s]+\s*$/
		// This test uses the certainty that ISBN numbers are unlikely to be mangled
		// If both (de-noised) ISBNs match the ref is declared a dupe, if not they are declared a NON dupe
		// if(dedupe.settings.match.isbn){
		// 	var r1Isbn = dedupe.getNumeric(ref1.isbn);
		// 	var r2Isbn = dedupe.getNumeric(ref2.isbn);
		// 	if(r1Isbn !== false && r2Isbn !== false){ // Can compare ISBNs
		// 		return {isDupe: r1Isbn == r2Isbn, reason: 'isbn'}; // If direct match its a dupe, if not its NOT a dupe
		// 	}
		// }
		// }}}
		
		// Stage 6 - Comparison of title + authors via string distance checking {{{
		var r1Title = ref1.title.toLowerCase();
		var r2Title = ref2.title.toLowerCase();

		/*if (
			natural.JaroWinklerDistance(r1Title, r2Title) >= config.tasks.dedupe.stringDistance.jaroWinklerMin &&
			natural.LevenshteinDistance(r1Title, r2Title) <= config.tasks.dedupe.stringDistance.levenshteinMax
		) {
			console.log('---DUPE---');
			console.log('REF1', r1Title);
			console.log('REF2', r2Title);
			console.log('JWD', colors.cyan(natural.JaroWinklerDistance(r1Title, r2Title)));
			console.log('Lev', colors.cyan(natural.LevenshteinDistance(r1Title, r2Title)));
			console.log('---');
		}*/

		if (
			(ref1.title && ref2.title) && // Has all required fields?
			( // Title matches or approximately matches
				ref1.title == ref2.title ||
				(
					natural.JaroWinklerDistance(r1Title, r2Title) >= dedupe.settings.stringDistances.jaroWinklerMin &&
					natural.LevenshteinDistance(r1Title, r2Title) <= dedupe.settings.stringDistances.levenshteinMax
				)
			) &&
			compareNames(ref1.authors || [], ref2.authors || []) // Authors look similar
		) return {isDupe: true, reason: 'title+authors'};
		// }}}

		// Final - not a duplicate {{{
		return {isDupe: false, reason: 'EXHAUSTED'};
		// }}}
	};

	/**
	* Asynchronously compare all entities within a collection firing emitters as duplicates are found
	* This function uses a lazy Cartesian product iterator to optimize the stack when iterating
	* @param {array} refs An array of references
	* @fires dupe A duplicate was found, called with both sides of the comparison and the duplicate result
	* @fires progress Indicates how far though the library the function has travelled. Function is called with current record number and maximum
	* @fires end The end-of-operation notifier
	* @return {Object} This object instance
	*/
	dedupe.compareAll = function(refs) {
		var finishedCompare = false;
		var throttledProgress = _.throttle((index, max) => {
			if (finishedCompare) return; // We've already signalled we've done - dont send another progress update
			dedupe.emit('progress', index, max);
		}, dedupe.settings.compareAll.progressThrottle, {leading: false});

		async()
			.use(asyncCartesian)
			.limit(dedupe.settings.compareAll.threadLimit)
			.compare(refs, function(nextRef, refs, index, max) {
				var result = dedupe.compare(refs[0], refs[1]);
				if (result.isDupe) {
					dedupe.emit('dupe', refs[0], refs[1], result);
				}
				throttledProgress(index, max);
				nextRef();
			})
			.end(function(err) {
				finishedCompare = true;
				if (err) return dedupe.emit('error', err);
				dedupe.emit('end');
			});

		return this;
	};

	return dedupe;
}

util.inherits(SRADedupe, events.EventEmitter);

module.exports = function(settings) {
	return new SRADedupe(settings);
};
