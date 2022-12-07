try {
	self.importScripts('../firebase/firebase-compat.js');

	const firebaseConfig = {
		apiKey: "AIzaSyA6d7Ahi7fMB4Ey8xXM8f9C9Iya97IGs-c",
		authDomain: "random--video-ex-chrome.firebaseapp.com",
		projectId: "random-youtube-video-ex-chrome",
		storageBucket: "random-youtube-video-ex-chrome.appspot.com",
		messagingSenderId: "141257152664",
		appId: "1:141257152664:web:f70e46e35d02921a8818ed",
		databaseURL: "https://random-youtube-video-ex-chrome-default-rtdb.europe-west1.firebasedatabase.app",
		// measurementId: "G-51M436YZF1",
	};

	const app = firebase.initializeApp(firebaseConfig);
	// console.log(app);

	const db = firebase.database(app);
	// console.log(db);

	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.command === 'get') {
			readDataOnce(request.data.key).then(sendResponse);
			return true;
		}

		// if (request.command === "post") {
		// 	writeData(request.data.key, request.data.val);
		// 	sendResponse("This is the result");
		// 	return true;
		// }

		return true;
	});

	// async function writeData(key, val) {
	// 	db.ref().update({
	// 		[key]: val
	// 	});
	// }

	async function readDataOnce(key) {
		return await db.ref(key).once('value').then((snapshot) => {
			return snapshot.val();
		});
	}

} catch (error) {
	console.error(error);
}