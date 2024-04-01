// Contains logic for interacting with Stripe for payment handling
import { firebaseConfig } from "./config.js";
import { getUser } from './googleOauth.js';
import { initializeApp } from 'firebase/app';
import { getFirestore, query, collection, where, getDocs, addDoc, onSnapshot, FieldPath } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get products and pricing information from Firestore/Stripe
async function getProducts(currency) {
	const currencyRef = new FieldPath('metadata', 'currency');
	const productCurrencyQuery = query(
		collection(db, 'products'),
		where('active', '==', true),
		where(currencyRef, '==', currency)
	);

	const productSnapshot = await getDocs(productCurrencyQuery);

	// TODO: Currently returns null if no product with currency is found. Should return USD price instead
	// For each product, get the product price info
	const productsPromises = productSnapshot.docs.map(async (productDoc) => {
		let productInfo = productDoc.data();

		// Fetch prices subcollection per product
		const priceQuerySnapshot = await getDocs(collection(productDoc.ref, 'prices'));

		// Iterate over all price documents and filter by currency
		// Even though we already filtered by currency in the product query, we filter again here to make sure to only get correct prices
		const pricesInfo = priceQuerySnapshot.docs.map((priceDoc) => {
			const priceInfo = priceDoc.data();
			return priceInfo.currency === currency ? { priceId: priceDoc.id, priceInfo } : null;
		}).filter(price => price !== null);

		productInfo['prices'] = pricesInfo;
		return productInfo;
	});

	const products = await Promise.all(productsPromises);

	// If no products with the requested currency are found, return products with USD pricing
	if (products.length == 0) {
		console.log(`No products found with currency ${currency}`);
		return getProducts('usd');
	}

	return {
		products: products.filter(product => product !== null),
		currency: currency
	};
}

export async function openStripeCheckout(user, requestedProduct, requestedCurrency, requestedInterval) {
	user ??= await getUser();
	// TODO: Do we want to scope to requestedProduct in getProducts as well?
	// In case the requested currency is not available, we default to USD
	const { products, currency } = await getProducts(requestedCurrency);

	// In theory, there should always only be one matching product returned by getProducts
	const shufflePlusTestProducts = products.find(p => p.name == requestedProduct);

	let paymentMethods = ['paypal', 'card', 'link'];
	if (currency == 'gbp') {
		// TODO: Confirm payment method works
		paymentMethods.push('revolut_pay');
	}

	let checkoutSessionData = {
		price: shufflePlusTestProducts.prices.find(p => p.priceInfo.type == 'recurring' && p.priceInfo.recurring.interval == requestedInterval).priceId,
		// TODO: Proper redirect URL, cancellation URL. Current URL does nothing after completion
		success_url: 'https://tinyurl.com/RYVShufflePlus?sessionId={CHECKOUT_SESSION_ID}',
		cancel_url: 'https://google.com?sessionId={CHECKOUT_SESSION_ID}',
		allow_promotion_codes: true,
		payment_method_types: paymentMethods
	};

	const checkoutSessionRef = await addDoc(
		collection(db, `users/${user.firebaseUid}/checkout_sessions`),
		checkoutSessionData
	);

	// The Stripe extension creates a payment link for us
	onSnapshot(checkoutSessionRef, (snap) => {
		const { error, url } = snap.data();
		if (error) {
			console.error(error);
			// TODO: Handle error
		}
		if (url) {
			// TODO: Decide whether to open a new tab or redirect the current tab
			chrome.tabs.create({ url });
			// window.location.assign(url);
		}
	});
}

// Gets all (active) subscriptions for the current user
export async function getSubscriptions(user = null, activeOnly = true) {
	user ??= await getUser();
	if (!user) {
		console.log("No user found");
		return [];
	}

	let q;
	if (activeOnly) {
		q = query(
			collection(db, `users/${user.firebaseUid}/subscriptions`),
			where('status', 'in', ['active', 'trialing'])
		);
	} else {
		q = collection(db, `users/${user.firebaseUid}/subscriptions`);
	}

	const querySnapshot = await getDocs(q);
	const subscriptions = querySnapshot.docs.map((doc) => doc.data());
	return subscriptions;
}