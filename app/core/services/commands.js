/* global angular, StellarSdk */

angular.module('app')
.factory('Commands', function ($http, $ionicLoading, $location, Contacts, Keychain, Modal, Wallet) {
	'use strict';

	return {
		onQrCodeScanned: onQrCodeScanned
	};

	function onQrCodeScanned(qrData) {

		try {
			const data = JSON.parse(qrData);
			if (!data.stellar) {
				return;
			}

			if (data.stellar.account) {
				if (data.stellar.key) {
					handleAccountImport(data.stellar.account, data.stellar.key);
				} else {
					handleContact(data.stellar.account);
				}
			}

			else if (data.stellar.payment) {
				handlePayment(data.stellar.payment);
			}

			else if (data.stellar.challenge) {
				handleChallenge(data.stellar.challenge);
			}
		}

		catch (err) {
			if (qrData.startsWith('centaurus:backup003')) {
				handleCentaurusImport(qrData);
			}

			else if (StellarSdk.StrKey.isValidEd25519PublicKey(qrData)) {
				const contact = {
					id: qrData
				};
				handleContact(contact);
			}
		}
	}

	function handleAccountImport(account, key) {

		const data = window.btoa(JSON.stringify({
			account: account,
			key: key
		}));
		$location.path(`/side-menu/import-account/${data}`);
	}

	function handleCentaurusImport(backupString) {

		const data = window.btoa(JSON.stringify({
			cipher: backupString.slice(19)
		}));

		$location.path(`/side-menu/import-centaurus/${data}`);
	}

	function handleContact(account) {

		if (!(account.id in Wallet.accounts) && !Contacts.lookup(account.id, account.network)) {
			/* eslint-disable camelcase */
			const data = {
				id:			account.id,
				meta:		account.meta,
				meta_type:	account.meta_type
			};
			/* eslint-enable camelcase */

			if (account.network) {
				data.network = account.network;
			}

			Modal.show('app/account/modals/add-contact.html', data);
		}
	}

	function handlePayment(payment) {
		const object = {
			destination:	payment.destination,
			amount:			payment.amount
		};

		/* eslint-disable camelcase */
		if (!payment.asset) {
			object.asset_type	= 'native';
		} else {
			object.asset_code	= payment.asset.code;
			object.asset_issuer	= payment.asset.issuer;
		}
		/* eslint-enable camelcase */

		if (payment.memo) {
			object.memo = payment.memo;
		}

		$location.path('/account/send')
		.search(object);
	}

	function handleChallenge(challenge) {

		const id = challenge.id ? challenge.id : Wallet.current.id;

		if (Keychain.isLocalSigner(id)) {
			Keychain.signMessage(id, challenge.message)
			.then(submitResponse);
		}

		function submitResponse(sig) {
			$ionicLoading.show({
				template: 'Submitting response...'
			});

			$http.post(challenge.url, {
				id: id,
				msg: challenge.message,
				sig: sig
			})
			.finally(() => {
				$ionicLoading.hide();
			});
		}
	}
});
