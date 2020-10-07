var _ = require('lodash');
var dedupe = require('..')();
var expect = require('chai').expect;

describe('dedupe.compare()', function() {

	it('should give up when titles are missing on either side', function() {
		expect(dedupe.compare({}, {title: 'hello'})).to.deep.equal({isDupe: false, reason: 'missing title'});
		expect(dedupe.compare({title: 'hello'}, {})).to.deep.equal({isDupe: false, reason: 'missing title'});

		expect(dedupe.compare({title: ''}, {title: 'hello'})).to.deep.equal({isDupe: false, reason: 'missing title'});
		expect(dedupe.compare({title: 'hello', title: ''}, {})).to.deep.equal({isDupe: false, reason: 'missing title'});
	});

	it('should mismatch if certain fields are unequal', function() {
		var original = {
			title: 'My awesome paper',
			authors: ['A. N. Other'],
			journal: 'Awesome Journal',
			year: '2016',
			pages: '25-27',
			volume: 15, 
			number: 2,
			isbn: '978-0553380958',
		};

		expect(dedupe.compare(_.assign(_.cloneDeep(original), {year: 2001}), _.cloneDeep(original))).to.be.deep.equal({isDupe: false, reason: 'year'});
		expect(dedupe.compare(_.cloneDeep(original), _.assign(_.cloneDeep(original), {pages: '28'}))).to.be.deep.equal({isDupe: false, reason: 'pages'});
		expect(dedupe.compare(_.assign(_.cloneDeep(original), {volume: 3}), _.cloneDeep(original))).to.be.deep.equal({isDupe: false, reason: 'volume'});
		expect(dedupe.compare(_.cloneDeep(original), _.assign(_.cloneDeep(original), {number: 4}))).to.be.deep.equal({isDupe: false, reason: 'number'});
		expect(dedupe.compare(_.cloneDeep(original), _.assign(_.cloneDeep(original), {isbn: '978-0653390957'}))).to.be.deep.equal({isDupe: false, reason: 'isbn'});

		// Identical versions should pass
		// expect(dedupe.compare(_.cloneDeep(original), _.cloneDeep(original))).to.be.deep.equal({isDupe: true, reason: 'isbn'});
	});

	it('should match on DOI duplicates', function() {
		expect(dedupe.compare({
			title: 'my paper',
			doi: '10.1109/5.771073',
		}, {
			title: 'another paper',
			doi: '10.1109/5.771073',
		})).to.deep.equal({isDupe: true, reason: 'doi'});

		expect(dedupe.compare({
			title: 'my paper',
			urls: ['http://my-paper.com', 'https://doi.org/10.1109/5.771073'],
		}, {
			title: 'another paper',
			doi: '10.1109/5.771073',
		})).to.deep.equal({isDupe: true, reason: 'doi'});
	});

	// it('should match on ISBN duplicates', function() {
	// 	expect(dedupe.compare({title: 'my paper', isbn: '978-0553380958'}, {title: 'another paper', isbn: '978-0553380958'})).to.deep.equal({isDupe: true, reason: 'isbn'});
		expect(dedupe.compare({title: 'my paper', isbn: '978-0563380958'}, {title: 'another paper', isbn: '978-0553380958'})).to.deep.equal({isDupe: false, reason: 'isbn'});
	// });

	it('should match on exact title + authors', function() {
		expect(dedupe.compare({title: 'foo'}, {title: 'foo'})).to.deep.equal({isDupe: true, reason: 'title+authors'});
		expect(dedupe.compare({title: 'foo', authors: []}, {title: 'foo'})).to.deep.equal({isDupe: true, reason: 'title+authors'});
		expect(dedupe.compare({title: 'foo', authors: ['A. N. Other']}, {title: 'foo', authors: ['A. N. Other']})).to.deep.equal({isDupe: true, reason: 'title+authors'});
		expect(dedupe.compare({title: 'foo', authors: ['A. N. Other']}, {title: 'foo', authors: ['Arnold Other']})).to.deep.equal({isDupe: true, reason: 'title+authors'});
		expect(dedupe.compare({title: 'foo bar baz'}, {title: 'foo baz bar'})).to.deep.equal({isDupe: true, reason: 'title+authors'});
	});

});
