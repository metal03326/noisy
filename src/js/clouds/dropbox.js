/**
 * Noisy communication module for Dropbox
 *
 * @author metal03326
 * @version 20170506
 */

// Dropbox singleton to be passed to Noisy
var dropbox = new Cloud( {
	name: 'Dropbox',

	urls: {
		connect: "//www.dropbox.com/oauth2/authorize?response_type=token&client_id=" +
							encodeURIComponent( "5lq1huyyozezyl5" ) +
							"&redirect_uri=" +
							encodeURIComponent( location.protocol + '//' + location.host + location.pathname ),
		info: {url: 'https://api.dropboxapi.com/2/users/get_current_account', method: 'POST'},
		query: {url: 'https://api.dropboxapi.com/2/files/list_folder', method: 'POST', jsonBody: '{"path":"{{path}}"}', headers: {'Content-Type': 'application/json; charset=utf-8'}},
		loadPlaylist: {url:'https://content.dropboxapi.com/2/files/download', method: 'POST', headers: {'Content-Type': ' ', 'Dropbox-API-Arg': '{"path": "{{path}}"}'}},
		play: {url: 'https://api.dropboxapi.com/2/files/get_temporary_link', method: 'POST', jsonBody: '{"path":"{{path}}"}', headers: {'Content-Type': 'application/json; charset=utf-8'}},
		savePlaylist: {url: 'https://content.dropboxapi.com/2/files/upload', method: 'POST', headers: {'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': '{"path": "{{path}}","mode": "add","autorename": true,"mute": false}'}}
	},

	responseKeys:
	{
		display_name: 'name.display_name',
		contents: 'entries',
		item: 'name',
		folder: '.tag',
        id: 'path_display'
	},

	rootPath: '/',

	usesIds: false
} );