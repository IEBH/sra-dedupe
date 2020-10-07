var dedupeLib = require('..');
var expect = require('chai').expect;

describe('dedupe.compareAll()', function() {

	it('should compare a non-duplicate library', function(done) {
		var dedupe = dedupeLib();
		dedupe.compareAll(require('./data/nodupes.json'))
			.on('dupe', function(ref1, ref2, result) {
				console.log('FAIL', ref1, ref2, result);
				expect.fail();
			})
			.on('end', done);
	});

	it('should compare a library with obvious duplicates', function(done) {
		this.timeout(10 * 10000);
		var library = require('./data/dupes-obvious.json');
		var dedupe = dedupeLib();
		var dupes = [];
		var progressUpdates = 0;
		dedupe.compareAll(library)
			.on('dupe', function(ref1, ref2, result) {
				dupes.push(result);
			})
			.on('progress', function(current, max) {
				progressUpdates++;
			})
			.on('end', function() {
				expect(progressUpdates).to.be.above(0);
				expect(dupes).to.have.length(100);
				done();
			});
	});

	it('should compare a library with duplicates', function(done) {
		this.timeout(10 * 10000);
		var library = require('./data/dupes.json');
		var dedupe = dedupeLib();
		var dupes = [];
		var progressUpdates = 0;
		dedupe.compareAll(library)
			.on('dupe', function(ref1, ref2, result) {
				dupes.push(result);
			})
			.on('progress', function(current, max) {
				progressUpdates++;
			})
			.on('end', function() {
				expect(progressUpdates).to.be.above(0);
				expect(dupes).to.have.length.above(0);
				expect(dupes).to.have.length.below(library.length / 6); // Only allow 1/6th of the library to be dupes
				done();
			});
	});

	it('should compare a library with duplicates 2', function(done) {
		this.timeout(10 * 10000);
		var library = require('./data/dupeissues.json');
		var dedupe = dedupeLib();
		var dupes = [];
		var progressUpdates = 0;
		dedupe.compareAll(library)
			.on('dupe', function(ref1, ref2, result) {
				console.log(result);
				dupes.push(result);
			})
			.on('progress', function(current, max) {
				progressUpdates++;
			})
			.on('end', function() {
				// expect(progressUpdates).to.be.above(0);
				expect(dupes).to.have.length(1); // Should only remove one duplicate
				done();
			});
	});
});
