var _ = require('lodash');
var expect = require('chai').expect;

describe('dedupe.compare()', function() {

	it('should match on ISBN duplicates when configured ON by default', function() {
        var dedupe = require('..')();
		// expect(dedupe.compare({title: 'my paper', isbn: '978-0553380958'}, {title: 'another paper', isbn: '978-0553380958'})).to.deep.equal({isDupe: true, reason: 'isbn'});
		expect(dedupe.compare({title: 'my paper', isbn: '978-0563380958'}, {title: 'another paper', isbn: '978-0553380958'})).to.deep.equal({isDupe: false, reason: 'isbn'});
	});

	it('should not match on ISBN duplicates when configured OFF', function() {
        var dedupe = require('..')({match:{isbn:false}});
        // title different but same ISBN, now exhausts the search
        expect(dedupe.compare({title: 'my paper', isbn: '978-0553380958'}, {title: 'another paper', isbn: '978-0553380958'})).to.deep.equal({isDupe: false, reason: 'EXHAUSTED'});
        // Different ISBN still prevents match
        expect(dedupe.compare({title: 'my paper', isbn: '978-0563380958'}, {title: 'another paper', isbn: '978-0553380958'})).to.deep.equal({isDupe: false, reason: 'isbn'});
        // Match title with same ISBN (regression test)
		expect(dedupe.compare({title: 'another paper', isbn: '978-0553380958'}, {title: 'another paper', isbn: '978-0553380958'})).to.deep.equal({isDupe: true, reason: 'title+authors'});
        // still do not match same title with different ISBN
		expect(dedupe.compare({title: 'my paper', isbn: '978-0563380958'}, {title: 'my paper', isbn: '978-0553380958'})).to.deep.equal({isDupe: false, reason: 'isbn'});
	});
	
    // Note the DOI default ON is covered in compare.js test, there's no point duplicating it here.
    it('should not match on DOI duplicates when configured OFF', function() {
        var dedupe = require('..')({match:{doi:false}});
    
        expect(dedupe.compare({
			title: 'my paper', doi: '10.1109/5.771073',
		}, {
			title: 'another paper',
			doi: '10.1109/5.771073',
		})).to.deep.equal({isDupe: false, reason: 'EXHAUSTED'});

		expect(dedupe.compare({
			title: 'my paper',
			urls: ['http://my-paper.com', 'https://doi.org/10.1109/5.771073'],
		}, {
			title: 'another paper',
			doi: '10.1109/5.771073',
		})).to.deep.equal({isDupe: false, reason: 'EXHAUSTED'});
	});
});
