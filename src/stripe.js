// Contains logic for interacting with Stripe for payment handling
import { firebaseConfig } from "./config.js";
import { getUser } from './googleOauth.js';
import { initializeApp } from 'firebase/app';
import { getFirestore, query, collection, where, getDocs, addDoc, onSnapshot } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get products and pricing information from Firestore/Stripe
async function getProducts() {
	const q = query(
		collection(db, 'products'),
		where('active', '==', true)
	);

	const querySnapshot = await getDocs(q);

	// for each product, get the product price info
	const productsPromises = querySnapshot.docs.map(async (productDoc) => {
		let productInfo = productDoc.data();

		// fetch prices subcollection per product
		const pricesCollection = collection(productDoc.ref, 'prices');
		const priceQuerySnapshot = await getDocs(pricesCollection);

		// iterate over all price documents
		const pricesInfo = priceQuerySnapshot.docs.map((priceDoc) => {
			return {
				priceId: priceDoc.id,
				priceInfo: priceDoc.data()
			};
		});

		productInfo['prices'] = pricesInfo;
		return productInfo;
	});

	const products = await Promise.all(productsPromises);
	return products;
}

export async function openStripeCheckout() {
	const currentUser = await getUser(false);
	console.log(currentUser);

	const products = await getProducts();
	console.log(products);

	// TODO: This must be done without reliance on the name being the same in case it changes
	const shufflePlusTestProduct = products.find(p => p.name === "Shuffle+ (Test)");
	// const shufflePlusProduct = products.find(p => p.name === "Shuffle+");

	console.log(shufflePlusTestProduct);

	// Get the available prices, which is a subkey prices on the product
	const shufflePlusTestPrices = shufflePlusTestProduct.prices;

	console.log(shufflePlusTestPrices);

	console.log(chrome.runtime.getURL('stripe.html'))
	// For testing, use the yearly price
	let checkoutSessionData = {
		price: shufflePlusTestPrices.find(p => p.priceInfo.type === 'recurring' && p.priceInfo.recurring.interval === 'year').priceId,
		success_url: 'http://localhost:3000/success'//chrome.runtime.getURL('stripe.html')
	};

	const checkoutSessionRef = await addDoc(
		// currentUser is provided by firebase, via getAuth().currentUser
		collection(db, `users/${currentUser.firebaseUid}/checkout_sessions`),
		checkoutSessionData
	);

	console.log(checkoutSessionRef);

	// The Stripe extension creates a payment link for us
	onSnapshot(checkoutSessionRef, (snap) => {
		const { error, url } = snap.data();
		if (error) {
			console.error(error);
			// handle error
		}
		if (url) {
			console.log(url)
			// Open a new page with the payment link
			chrome.tabs.create({ url });
			// window.location.assign(url);  // redirect to payment link
		}
	});
}
