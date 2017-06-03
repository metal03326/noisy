/**
 * Noisy communication base module
 *
 * @author metal03326
 * @version 20170506
 */

'use strict';

// Clouds class to use as base for other cloud services
class Cloud
{
	constructor( props = [] )
	{
		// Access token returned by OAuth 2.0
		this.accessToken = null;

		// ObjectUrl manager for CRUD operations with ObjectUrls
		this.urlManager = urlManager;

		// Whether the cloud service uses id for files/folders or it uses a regular path
		this.usesIds = false;

		// Copy all the passed props
		Object.assign( this, props );
	}

	/**
	 * All AJAX calls to all cloud services are made through here.
	 * @param {String} url Required. URL to which to connect.
	 * @param {Function} successCallback Required. Function to be called if the AJAX request is a success.
	 * @param {Function} failureCallback Required. Function to be called if the AJAX request is a failure.
	 * @param {String} [method] Optional. Request method. Defaults to GET.
	 * @param {String} [body] Optional. Request body.
	 * @param {Object} [params] Optional. Request headers. Key is the header, value is the value.
	 * @param {String} [responseType] Optional. Request response type.
	 */
	ajaxRequest( url, successCallback, failureCallback, method = 'GET', body, params = {}, responseType )
	{
		//todo: Try using Fetch API. If not - at lease convert this to Promises
		let xhr = new XMLHttpRequest();

		// Make sure the request won't give up
		xhr.timeout = 0;

		xhr.onreadystatechange = () =>
		{
			if ( 4 === xhr.readyState )
			{
				if ( 200 === xhr.status )
				{
					successCallback( xhr );
				}
				else
				{
					failureCallback( xhr );
				}
			}
		};

		xhr.open( method, url, true );

		if ( responseType )
		{
			xhr.responseType = responseType;
		}

		xhr.setRequestHeader( 'Authorization', 'Bearer ' + this.accessToken );

		Object.keys( params ).forEach( param =>
		{
			xhr.setRequestHeader( param, params[ param ] );
		} );

		xhr.send( body );
	}

	/**
	 * Parses the name of the cloud service and generates a codename.
	 * @returns {String} codename
	 */
	get codeName()
	{
		return this.name.toLowerCase().replace( / |\./g, '' );
	}

	/**
	 * Connect to cloud service method.
	 */
	connect()
	{
		n.pref.tokenCloud = this.codeName;
		location.href     = this.urls.connect;
	}

	/**
	 * Checks if cloud token is valied.
	 * @param {Function} successCallback Required. Function to be called if the token is valid.
	 * @param {Function} failureCallback Required. Function to be called if the token is invalid.
	 */
	checkToken( successCallback, failureCallback )
	{
		let infoURL = this.urls.info;

		this.ajaxRequest( infoURL.url, xhr =>
		{
			let display_name = '';

			// Support for nested objects (name.display_name)
			let namePath = this.responseKeys.display_name.split( '.' );
			let response = JSON.parse( xhr.responseText );

			namePath.forEach( ( part, index ) =>
			{
				// If we are the last part of the path to the name, then we should actually be the holder of the name
				if ( index + 1 === namePath.length )
				{
					display_name = response[ part ];
				}
				// Otherwise start digging
				else
				{
					response = response[ part ];
				}
			} );

			this.display_name = display_name;

			successCallback( this );
		}, xhr =>
		{
			failureCallback( this, xhr );
		}, infoURL.method );
	}

	/**
	 * Lists all the files/folders in a cloud services.
	 * @param {String} path Required. Path/ID of the folder to be loaded.
	 * @param {Function} [successCallback] Optional. Function to be called if folder list was a success.
	 * @param {Function} [failureCallback] Optional. Function to be called if folder list was a failure.
	 */
	getFolderContents( path, successCallback, failureCallback )
	{
		// Empty window and create "up" element only if call to getFolderContents does not have callbacks (it's not a
		// deep folder listing)
		if ( !successCallback )
		{
			n.emptyAddWindow();

			// If we are not loading the root folder
			if ( path )
			{
				let up = this.rootPath;

				// If current clound isn't using ids, we need to orient ourselves with forward slashes
				if ( !this.usesIds )
				{
					up = path.split( '/' );
					up.pop();
					up = up.join( '/' );
				}

				// We need to add .. folder for the user to be able to go back
				let toAdd = {
					cloud : this.codeName,
					name  : '..',
					folder: true,
					path  : up
				};

				// If we are not using ids, we know the path for previous folder so we just render it
				if ( !this.usesIds )
				{
					n.addItemToWindow( toAdd );
				}
				// Otherwise we need to get the id from the cloud
				else
				{
					up = n.addItemToWindow( toAdd );

					// 10 retries for this request.
					//TODO: Make this 10 iterations a CONST and use it everywhere
					asyncLoop( 10, loop =>
					{
						this.ajaxRequest( this.urls.folder.replace( '{{path}}', path ), xhr =>
							{
								let resp = JSON.parse( xhr.responseText );

								if ( resp.parents.length )
								{
									up.dataset.path = resp.parents[ 0 ].id;
								}
								else
								{
									up.parentNode.removeChild( up );
								}
							},
							() =>
							{
								n.log( 'connection-retry', loop.index );
								n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
								loop.next();
							} );
					}, () =>
					{
						n.setFooter( null, true );
						n.error( 'cannot-load-url', this.urls.folder );
					} );
				}
			}
			else
			{
				path = this.rootPath;
			}

			//Move it somewhere else. Line below too.
			document.getElementById( 'add-window-files' ).dataset.path = path;
		}

		let window = document.getElementById( 'add-window-files' );
		let filter = window.dataset.filter;

		window.dataset.cloud = this.codeName;

		let queryURL = this.urls.query;
		let body;

		// Dropbox needs the path to be part of the body, not the URL
		if ( queryURL.jsonBody )
		{
			//todo: Dropbox requires root folder to be empty string. Remove that hack.
			if ( path === '/' )
			{
				path = '';
			}

			body = queryURL.jsonBody.replace( '{{path}}', path );
		}

		this.ajaxRequest( queryURL.url.replace( '{{path}}', path ), xhr =>
		{
			let response = JSON.parse( xhr.responseText );
			let files    = [];
			let folders  = [];

			response[ this.responseKeys.contents ].forEach( item =>
			{
				let toAdd = {
					cloud : this.codeName,
					name  : item[ this.responseKeys.item ],
					folder: !!~item[ this.responseKeys.folder ].indexOf( 'folder' ),
					path  : item[ this.responseKeys.id ? this.responseKeys.id : this.responseKeys.item ]
				};

				if ( !this.usesIds && '/' === toAdd.name.charAt( 0 ) )
				{
					toAdd.name = toAdd.name.substring( 1 );
				}

				if ( toAdd.folder )
				{
					folders.push( toAdd );
				}
				else if ( !filter || ~toAdd.name.lastIndexOf( filter ) )
				{
					if ( this.usesIds )
					{
						toAdd.downloadURL = item.downloadUrl;
					}
					files.push( toAdd );
				}
			} );

			if ( 'function' === typeof successCallback )
			{
				successCallback( files, folders );
				return;
			}

			folders.forEach( n.addItemToWindow );

			files.forEach( n.addItemToWindow );

			n.applyWindowState( 'semi' );

			document.getElementById( 'loading-folder-contents' ).classList.add( 'visibility-hidden' );
		}, () =>
		{
			if ( 'function' === typeof failureCallback )
			{
				failureCallback();
			}
		}, queryURL.method, body, queryURL.headers );
	}

	/**
	 * Loads playlist from the cloud.
	 * @param {HTMLElement} item Required. Item chosen by the user to be loaded.
	 */
	loadPlaylist( item )
	{
		let loadPlaylistURL = this.urls.loadPlaylist;
		let headers         = {};
		let url             = this.usesIds ? item.dataset.downloadURL : loadPlaylistURL.url;

		Object.keys( loadPlaylistURL.headers ).forEach( header =>
		{
			headers[ header ] = loadPlaylistURL.headers[ header ].replace( '{{path}}', item.dataset.path );
		} );

		asyncLoop( 10, loop =>
		{
			this.ajaxRequest( url, xhr =>
				{
					let response = JSON.parse( xhr.responseText );

					if ( 'playlist' !== response.type )
					{
						throw new Error( 'Not a valid playlist' );
					}
					else
					{
						n.loadPlaylist( response );

						let tab = document.querySelector( 'li[data-for="'.concat( response.id, '"]' ) );

						if ( tab )
						{
							n.changePlaylist( tab );
						}
					}
				},
				() =>
				{
					n.log( 'connection-retry', loop.index );
					n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
					loop.next();
				}, loadPlaylistURL.method, void 0, headers );
		}, () =>
		{
			n.setFooter( null, true );
			n.error( 'cannot-load-url', url );
		} );
	}

	/**
	 * Loads preferences from the cloud.
	 * @param {HTMLElement} item Required. Item chosen by the user to be loaded.
	 */
	loadPreferences( item )
	{
		let loadPlaylistURL = this.urls.loadPlaylist;
		let headers         = {};
		let url             = this.usesIds ? item.dataset.downloadURL : loadPlaylistURL.url;

		Object.keys( loadPlaylistURL.headers ).forEach( header =>
		{
			headers[ header ] = loadPlaylistURL.headers[ header ].replace( '{{path}}', item.dataset.path );
		} );

		asyncLoop( 10, loop =>
		{
			this.ajaxRequest( url, xhr =>
				{
					let response = JSON.parse( xhr.responseText );

					if ( 'preferences' !== response.type )
					{
						throw new Error( 'Not a valid preferences file' );
					}
					else
					{
						delete response.type;
						n.pref.import( response );
					}
				},
				() =>
				{
					n.log( 'connection-retry', loop.index );
					n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
					loop.next();
				}, loadPlaylistURL.method || 'GET', '', headers );
		}, () =>
		{
			n.setFooter( null, true );
			n.error( 'cannot-load-url', url );
		} );
	}

	_preload( url, item )
	{
		n.setItemState( 'w', false, item );

		asyncLoop( 10, loop =>
		{
			this.ajaxRequest( url, xhr =>
			{
				let buffer    = xhr.response;
				let tag;
				let extension = item.dataset.placeholder.split( '.' ).pop();
				let mimeType  = 'unknown';

				switch ( extension )
				{
					case 'mp3':
						mimeType = 'audio/mpeg';
						break;
					case 'ogg':
						mimeType = 'audio/ogg';
						break;
					case 'm4a':
						mimeType = 'audio/mp4';
						break;
					case 'wav':
						mimeType = 'audio/wav';
						break;
				}

				let metadata = n.powerSaveMode ? {} : n.readTags( buffer, extension );

				Object.assign( item.dataset, metadata );

				// Check if current item is supported by the browser
				if ( mimeType && !~n.formats.indexOf( mimeType ) )
				{
					item.classList.add( 'can-not-play' );
				}

				let blob      = new Blob( [ buffer ], { type: mimeType } );
				let objectUrl = URL.createObjectURL( blob );

				this.urlManager.add( item.dataset.url, objectUrl );

				if ( document.getElementById( n.audio.dataset.playlist ).querySelectorAll( '.playlist-item' )[ n.audio.dataset.item ] !== item )
				{
					n.setItemState( null, false, item );
				}

				let audio   = document.createElement( 'audio' );
				audio.muted = true;

				audio.addEventListener( 'loadedmetadata', () =>
				{
					// Set duration to the item, so we can save it later
					// Format duration using toHHMMSS() method defined in main.js
					item.dataset.duration = Math.floor( audio.duration ).toString().toHHMMSS();

					audio.parentNode.removeChild( audio );

					n.renderItem( item );

					// Save the data
					n.saveActivePlaylist();
				} );

				document.body.appendChild( audio );
				audio.src = objectUrl;
				audio.load();

				let itm = document.getElementById( n.audio.dataset.playlist ).querySelectorAll( '.playlist-item' )[ parseInt( n.audio.dataset.item, 10 ) ];

				if ( itm === item )
				{
					n.setTitle( item );
					n.setFooter( item );
					n.lastfm.updateNowPlaying( item );
				}

				// Play the preloaded item if Noisy is not playing anything (but not just paused). This may
				// occur when previous item finished playback while this one is being loaded.
				// First check is to assure the player is not running.
				// Second check assures player is not just paused.
				// Third check shows if the player is stopped by the user (data-item gets removed then)
				if (
					n.audio.paused &&
					( 0 === n.audio.currentTime || n.audio.currentTime === n.audio.duration ) &&
					n.audio.dataset.item )
				{
					n[ item.dataset.cloud ].play( item );
				}
			}, () =>
			{
				n.log( 'connection-retry', loop.index );
				n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
				loop.next();
			}, 'GET', void 0, {}, 'arraybuffer' );
		}, () =>
		{
			n.setFooter( null, true );
			n.error( 'cannot-load-url', url );
		} );
	}

	preload( item )
	{
		if ( !this.urlManager.get( item.dataset.url ) )
		{
			if ( !this.usesIds && this.constructor.isValid( item ) )
			{
				this._preload( item.dataset.tempurl, item );
			}
			else
			{
				let playURL = this.urls.play;
				let body;

				// Dropbox needs the path to be part of the body, not the URL
				if ( playURL.jsonBody )
				{
					body = playURL.jsonBody.replace( '{{path}}', item.dataset.url );
				}

				let url = playURL.url.replace( '{{path}}', item.dataset.url );

				asyncLoop( 10, loop =>
				{
					this.ajaxRequest( url, xhr =>
					{
						let response = JSON.parse( xhr.responseText );

						item.dataset.tempurl = this.usesIds ? response.downloadUrl : response.link;
						item.dataset.expires = response.expires ? response.expires : new Date( +new Date() + 14400000 );

						n.saveActivePlaylist();

						this._preload( item.dataset.tempurl, item );
					}, () =>
					{
						n.log( 'connection-retry', loop.index );
						n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
						loop.next();
					}, playURL.method, body, playURL.headers );
				}, () =>
				{
					n.setFooter( null, true );
					n.error( 'cannot-load-url', url );
				} );
			}
		}
	}

	/**
	 * Loads a file from the cloud and passes it to an audio element for playback.
	 * @param {String} url Required. URL/ID of the file to be loaded.
	 * @param {HTMLElement} item Required. Playlist item which is being loaded.
	 * @private
	 */
	_loadItemFromURL( url, item )
	{
		// Show that we are loading an item. Useful for pre-loading
		n.setItemState( 'w', false, item );

		function _loadedMetadata()
		{
			n.audio.removeEventListener( 'loadedmetadata', _loadedMetadata );

			// Reset playback state, as we finished loading
			n.setItemState( null, false, item );

			let itm = document.getElementById( n.audio.dataset.playlist ).querySelectorAll( '.playlist-item' )[ parseInt( n.audio.dataset.item, 10 ) ];

			// When fast switching items we receive more calls to this handler and we should process only the one that
			// matters
			if ( item !== itm )
			{
				return;
			}

			// Set duration to the item, so we can save it later
			// Format duration using toHHMMSS() method defined in main.js
			item.dataset.duration = Math.floor( n.audio.duration ).toString().toHHMMSS();

			// Checks for Mozilla's mozGetMetadata() method of the HTML
			// Audio tag and uses it to get more metadata out of the file
			if ( 'function' === typeof n.audio.mozGetMetadata && !n.powerSaveMode )
			{
				let metadata = n.audio.mozGetMetadata();

				Object.keys( metadata ).forEach( prop =>
				{
					item.dataset[ prop.toLowerCase() ] = metadata[ prop ];
				} );
			}

			// Save playlist as we have new data
			n.savePlaylist( item.parentNode );

			// Render new data on the screen
			n.renderItem( item );
			n.setTitle( item );
			n.setFooter( item );
		}

		// Get the metadata from the file
		n.audio.addEventListener( 'loadedmetadata', _loadedMetadata );

		n.lastfm.scrobble();

		let items = item.parentNode.querySelectorAll( '.playlist-item' );

		// Get the index of the focused item and tell the audio element which item is being played, so we can later get
		// it
		n.audio.dataset.item     = Array.prototype.indexOf.call( items, item );
		n.audio.dataset.playlist = item.parentNode.id;

		n.audio.src = url;

		this.preload( item );
	}

	/**
	 * Load file from Dropbox and assign it as a source for the HTML Audio.
	 *
	 * @param {HTMLElement} item Required. Used to get the URL to the cloud item that should be loaded.
	 */
	play( item )
	{
		// Do nothing if no item to play passed. Happens when there is still item being loaded, but playback finished.
		if ( !item )
		{
			return;
		}

		// Check with UrlManager if we already have this file pre-loaded and just play it if we have it
		if ( this.urlManager.get( item.dataset.url ) )
		{
			n.lastfm.scrobble();

			let items = item.parentNode.querySelectorAll( '.playlist-item' );

			// Get the index of the focused item and tell the audio element which item is being played, so we can later
			// get it
			n.audio.dataset.item     = Array.prototype.indexOf.call( items, item );
			n.audio.dataset.playlist = item.parentNode.id;

			n.audio.src = this.urlManager.get( item.dataset.url );
			n.audio.load();
		}
		else if ( this.constructor.isValid( item ) )
		{
			//				if( item.dataset.duration )
			//				{
			//					n.audio.src = item.dataset.tempurl;
			//					n.audio.load();
			//					n.notify();
			//				}
			//				else
			//				{
			this._loadItemFromURL( item.dataset.tempurl, item );
			//				}
		}
		else
		{
			let playURL = this.urls.play;
			let body;

			// Dropbox needs the path to be part of the body, not the URL
			if ( playURL.jsonBody )
			{
				body = playURL.jsonBody.replace( '{{path}}', item.dataset.url );
			}

			let url = playURL.url.replace( '{{path}}', encodeURIComponent( item.dataset.url ) );

			asyncLoop( 10, loop =>
			{
				this.ajaxRequest( url, xhr =>
				{
					let response = JSON.parse( xhr.responseText );

					item.dataset.tempurl = this.usesIds ? response.downloadUrl.replace( '&gd=true', '' ) : response.link;
					item.dataset.expires = response.expires ? response.expires : new Date( +new Date() + 14400000 );

					n.saveActivePlaylist();
					//						if( item.dataset.duration )
					//						{
					//							n.audio.src = item.dataset.tempurl;
					//							n.audio.load();
					//							n.notify();
					//						}
					//						else
					//						{
					this._loadItemFromURL( item.dataset.tempurl, item );
					//						}
				}, () =>
				{
					n.log( 'connection-retry', loop.index );
					n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
					loop.next();
				}, playURL.method, body, playURL.headers );
			}, () =>
			{
				n.setFooter( null, true );
				n.error( 'cannot-load-url', url );
			} );
		}
	}

	/**
	 * Saves the active playlist to the cloud.
	 * @param {String} file Required. Filename of the playlist file being saved.
	 * @param {String} path Required. Path to the file in which the playlist will be saved.
	 */
	savePlaylist( file, path )
	{
		let pst = n.saveActivePlaylist( true );

		if ( pst )
		{
			pst.type = 'playlist';

			let savePlaylistURL = this.urls.savePlaylist;
			let headers         = {};
			let savePath        = (path + '/' + file).replace( '//', '/' );
			let url             = savePlaylistURL.url.replace( '{{path}}', savePath );

			Object.keys( savePlaylistURL.headers ).forEach( header =>
			{
				headers[ header ] = savePlaylistURL.headers[ header ].replace( '{{path}}', savePath );
			} );

			asyncLoop( 10, loop =>
			{
				this.ajaxRequest( url, xhr =>
				{
					if ( this.usesIds )
					{
						let response = JSON.parse( xhr.responseText );

						url = this.urls.savePlaylist2.replace( '{{path}}', response.id );

						asyncLoop( 10, loop =>
						{
							this.ajaxRequest( url, () =>
							{
								n.log( 'saved', url );
								n.setFooter( n.lang.footer[ 'operation-successful' ] );
							}, () =>
							{
								n.log( 'connection-retry', loop.index );
								n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
								loop.next();
							}, 'PUT', '{"title":"' + file + '","parents":[{"id":"' + path + '"}]}', { 'Content-Type': 'application/json' } );
						}, () =>
						{
							n.error( 'failed-to-save', url );
							n.setFooter( n.lang.footer[ 'error-see-console' ] );
						} );
					}
					else
					{
						n.log( 'saved', url );
						n.setFooter( n.lang.footer[ 'operation-successful' ] );
					}
				}, () =>
				{
					n.log( 'connection-retry', loop.index );
					n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
					loop.next();
				}, 'POST', JSON.stringify( pst ), headers );
			}, () =>
			{
				n.error( 'failed-to-save', url );
				n.setFooter( n.lang.footer[ 'error-see-console' ] );
			} );
		}
	}

	/**
	 * Saves the preferences to the cloud.
	 * @param {String} file Required. Filename of the preferences file being saved.
	 * @param {String} path Required. Path to the file in which the preferences will be saved.
	 */
	savePreferences( file, path )
	{
		let pref = n.pref.export();

		if ( pref )
		{
			pref.type = 'preferences';

			let savePlaylistURL = this.urls.savePlaylist;
			let headers         = {};
			let savePath        = (path + '/' + file).replace( '//', '/' );
			let url             = savePlaylistURL.url.replace( '{{path}}', savePath );

			Object.keys( savePlaylistURL.headers ).forEach( header =>
			{
				headers[ header ] = savePlaylistURL.headers[ header ].replace( '{{path}}', savePath );
			} );

			asyncLoop( 10, loop =>
			{
				this.ajaxRequest( url, xhr =>
				{
					if ( this.usesIds )
					{
						let response = JSON.parse( xhr.responseText );

						url = this.urls.savePlaylist2.replace( '{{path}}', response.id );

						asyncLoop( 10, loop =>
						{
							this.ajaxRequest( url, () =>
							{
								n.log( 'saved', url );
								n.setFooter( n.lang.footer[ 'operation-successful' ] );
							}, () =>
							{
								n.log( 'connection-retry', loop.index );
								n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
								loop.next();
							}, 'PUT', '{"title":"' + file + '.plst.nsy"}', { 'Content-Type': 'application/json' } );
						}, () =>
						{
							n.error( 'failed-to-save', url );
							n.setFooter( n.lang.footer[ 'error-see-console' ] );
						} );
					}
					else
					{
						n.log( 'saved', url );
						n.setFooter( n.lang.footer[ 'operation-successful' ] );
					}
				}, () =>
				{
					n.log( 'connection-retry', loop.index );
					n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
					loop.next();
				}, 'POST', JSON.stringify( pref ), headers );
			}, () =>
			{
				n.error( 'failed-to-save', url );
				n.setFooter( n.lang.footer[ 'error-see-console' ] );
			} );
		}
	}

	/**
	 * Checks authentication state.
	 *
	 * @return {Boolean} True if authenticated and false if not.
	 */
	get isAuthenticated()
	{
		return !!this.accessToken;
	}

	/**
	 * Checks if playlist item contains a valid temporary URL.
	 * @param {HTMLElement} item Required. Playlist item to be checked.
	 * @returns {boolean}
	 */
	static isValid( item )
	{
		//todo: This doesn't seems right. Fix.
		return 1 === new Date( item.dataset.expires || Date.now() ) > new Date();
	}
}