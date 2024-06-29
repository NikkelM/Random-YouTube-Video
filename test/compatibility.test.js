import expect from 'expect.js';

describe('compatibility', function () {
	context('YouTube', function () {
		it('should redirect multiple videos to a temporary playlist URL', async function () {
			const watchVideosUrl = 'https://www.youtube.com/watch_videos?video_ids=dQw4w9WgXcQ,dQw4w9WgXcQ,dQw4w9WgXcQ,dQw4w9WgXcQ';
			const redirectedUrl = (await fetch(watchVideosUrl)).url;

			// The playlist is temporary, indicated by a TL start in the ID
			expect(redirectedUrl).to.contain('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=TL');
		});
	});
});