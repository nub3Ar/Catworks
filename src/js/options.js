'use strict';

//page action js
jQuery(document).ready(function () {
	$('.modal').modal();
	if (!localStorage.getItem('url')) {
		$('#sheet_iframe').hide()
	}
	$('#sheet_iframe').attr('src', localStorage.getItem('url'))
	$('#option1').click(function(){console.log($('#option1').val())})
});


// Authentication Functions
var authentication = (function () {

	var SCRIPT_ID = '1nPvptCpoQZKnaYCCzjs_dN4HldFucBUCpXJ9JYh0POK-cLPlenYP2KBT';
	var STATE_START = 1;
	var STATE_ACQUIRING_AUTHTOKEN = 2;
	var STATE_AUTHTOKEN_ACQUIRED = 3;

	var state = STATE_START;

	var signin_button, revoke_button, create_button, delete_button, delete_trigger, setting_button, setting_trigger;

	function disableButton(button) {
		button.setAttribute('disabled', 'disabled');
	}

	function enableButton(button) {
		button.removeAttribute('disabled');
	}

	function changeState(newState) {
		state = newState;
		switch (state) {
			case STATE_START:
				enableButton(signin_button);
				disableButton(delete_trigger);
				disableButton(setting_trigger)
				disableButton(create_button);
				disableButton(revoke_button);
				localStorage.setItem('token_exist', false)
				break;
			case STATE_ACQUIRING_AUTHTOKEN:
				disableButton(signin_button);
				disableButton(delete_trigger);
				disableButton(setting_trigger)
				disableButton(create_button);
				disableButton(revoke_button);
				break;
			case STATE_AUTHTOKEN_ACQUIRED:
				disableButton(signin_button);
				enableButton(revoke_button);
				localStorage.setItem('token_exist', true)
				break;
		}
	}

	/**
	 * Get users access_token.
	 *
	 * @param {object} options
	 *   @value {boolean} interactive - If user is not authorized ext, should auth UI be displayed.
	 *   @value {function} callback - Async function to receive getAuthToken result.
	 */
	function getAuthToken(options) {
		chrome.identity.getAuthToken({
			'interactive': options.interactive
		}, options.callback);
	}

	/**
	 * Get users access_token in background with now UI prompts.
	 */
	function getAuthTokenSilent() {
		getAuthToken({

			'interactive': false,
			'callback': getAuthTokenCallback,
		});
	}

	/**
	 * Get users access_token or show authorize UI if access has not been granted.
	 */
	function getAuthTokenInteractive() {
		getAuthToken({
			'interactive': true,
			'callback': getAuthTokenCallback,
		});
	}

	/**
	 * Handle response from authorization server.
	 *
	 * @param {string} token - Google access_token to authenticate request with.
	 */
	function getAuthTokenCallback(token) {
		// Catch chrome error if user is not authorized.
		if (chrome.runtime.lastError) {
			localStorage.setItem('token_exist', false)
			changeState(STATE_START);
		} else {
			localStorage.setItem('token_exist', true)
			changeState(STATE_AUTHTOKEN_ACQUIRED);
			if (localStorage.getItem('url')) {
				disableButton(create_button)
				enableButton(delete_trigger)
			}
			else{
				enableButton(create_button)
			}
		}
	}

	/**
	 * Revoking the access token.
	 */
	function revokeToken() {
		getAuthToken({
			'interactive': false,
			'callback': revokeAuthTokenCallback,
		});
	}

	/**
	 * Revoking the access token callback
	 */
	function revokeAuthTokenCallback(current_token) {
		if (!chrome.runtime.lastError) {

			// Remove the local cached token
			chrome.identity.removeCachedAuthToken({
				token: current_token
			}, function () {});

			// Make a request to revoke token in the server
			var xhr = new XMLHttpRequest();
			xhr.open('GET', 'https://accounts.google.com/o/oauth2/revoke?token=' +
				current_token);
			xhr.send();
			
			localStorage.setItem('token_exist', false)
			// Update the user interface accordingly
			changeState(STATE_START);
		}

	}

	/**
	 * Make an authenticated HTTP POST request.
	 *
	 * @param {object} options
	 *   @value {string} url - URL to make the request to. Must be whitelisted in manifest.json
	 *   @value {object} request - Execution API request object
	 *   @value {string} token - Google access_token to authenticate request with.
	 *   @value {function} callback - Function to receive response.
	 */
	function post(options) {
		var xhr = new XMLHttpRequest();
		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4 && xhr.status === 200) {
				// JSON response assumed. Other APIs may have different responses.
				options.callback(JSON.parse(xhr.responseText));
			} else if (xhr.readyState === 4 && xhr.status !== 200) {}
		};
		xhr.open('POST', options.url, true);
		// Set standard Google APIs authentication header.
		xhr.setRequestHeader('Authorization', 'Bearer ' + options.token);
		xhr.send(JSON.stringify(options.request));
	}

	function createSheet() {
		getAuthToken({
			'interactive': false,
			'callback': createSheetCallback,
		});
	}

	/**
	 * @param {string} token
	 */
	function createSheetCallback(token) {
		post({
			'url': 'https://script.googleapis.com/v1/scripts/' + SCRIPT_ID + ':run',
			'callback': createSheetResponse,
			'token': token,
			'request': {
				'function': 'createSheet',
			}
		});
	}

	function createSheetResponse(response) {
		disableButton(create_button);
		enableButton(setting_trigger);
		enableButton(delete_trigger);
		if (response.response.result.status == 'ok') {
			console.log(response.response.result.url);
			localStorage.setItem('url', response.response.result.url);
			localStorage.setItem('id', response.response.result.id);
		}
	}

	function userSetting() {
		getAuthToken({
			'interactive': false,
			'callback': userSettingCallback,
		});
	}

	/**
	 * @param {string} token
	 */
	function userSettingCallback(token) {
		let option_array = [];
		var inputs = document.getElementsByTagName('input');
		for (let index = 0; index < inputs.length; ++index) {
			if (inputs[index].getAttribute('id') && inputs[index].getAttribute('id').includes('option')) {
				if (inputs[index].checked == true){
					option_array.push(inputs[index].value)
				}
				else{
					option_array.push("no")
			}
			localStorage.setItem('optionArray', option_array);
				}
		}

		post({
			'url': 'https://script.googleapis.com/v1/scripts/' + SCRIPT_ID + ':run',
			'callback': userSettingResponse,
			'token': token,
			'request': {
				'function': 'settingColumns',
				'parameters': {
					'option_array': option_array,
					'url': localStorage.getItem('url')
				}
			}
		});
	}

	function userSettingResponse(response) {
		if (response.response.result.status == 'ok') {
			window.location.reload();
		}
		else{
			console.log(response.response.result.status)
		}

	}

	function deleteSheet() {
		getAuthToken({
			'interactive': false,
			'callback': deleteSheetCallback,
		});
	}

	/**
	 * @param {string} token
	 */
	function deleteSheetCallback(token) {
		post({
			'url': 'https://script.googleapis.com/v1/scripts/' + SCRIPT_ID + ':run',
			'callback': deleteSheetResponse,
			'token': token,
			'request': {
				'function': 'deleteSheet',
				'parameters': {
					'sheet_id': localStorage.getItem('id')
				}
			}
		});
	}

	function deleteSheetResponse(response) {
		if (response.response.result.status == 'ok') {
			disableButton(delete_trigger);
			disableButton(setting_trigger);
			enableButton(create_button);
			Materialize.toast('Information deleted, Please reload the page', 3000);
			localStorage.removeItem('url');
			localStorage.removeItem('id');
			setTimeout(function(){window.location.reload();}, 2000)

		} else {
			Materialize.toast('Deletion Error. Please Try Again', 3000);
		}
	}

	return {
		onload: function () {

			signin_button = document.querySelector('#signin');
			signin_button.addEventListener('click', getAuthTokenInteractive);

			revoke_button = document.querySelector('#revoke');
			revoke_button.addEventListener('click', revokeToken);

			create_button = document.querySelector('#createsheet');
			create_button.addEventListener('click', createSheet);

			delete_trigger = document.querySelector('#deletesheet_btn');
			delete_button = document.querySelector('#deletesheet')
			delete_button.addEventListener('click', deleteSheet)

			setting_trigger = document.querySelector('#setting_btn')
			setting_button = document.querySelector('#save_setting')
			setting_button.addEventListener('click', userSetting)


			if (localStorage.getItem('url')) {
				disableButton(create_button);
			}
			else{
				disableButton(delete_button);
				disableButton(setting_trigger);
			}

			// Trying to get access token without signing in, 
			// it will work if the application was previously 
			// authorized by the user.
			getAuthTokenSilent();
		}
	};
})();

window.onload = authentication.onload;