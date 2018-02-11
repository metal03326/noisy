/**
 * Noisy communication base module
 *
 * @author metal03326
 * @version 20170506
 */

'use strict';

// Clouds class to use as base for other cloud services
class Cloud {
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
	 * @param {String} url URL to which to connect.
	 * @param {String} [method] Request method. Defaults to GET.
	 * @param {String} [body] Request body.
	 * @param {Object} [headers] Request headers. Key is the header, value is the value.
	 * @param {String} [responseType] Request response type.
	 */
	fetch( url, method = 'GET', body, headers = {}, responseType )
	{
		return fetch( url, {
			mode   : 'cors',
			method,
			// Remove empty ('') body - GET requests do not have body
			body   : body || void 0,
			headers: Object.assign( { 'Authorization': `Bearer ${this.accessToken}` }, headers )
		} ).then( response =>
		{
			if ( response.status >= 200 && response.status < 300 )
			{
				if ( responseType === 'arraybuffer' )
				{
					return response.arrayBuffer();
				}

				return response.json();
			}
			else
			{
				let error      = new Error( response.status );
				error.name     = 'FetchError';
				error.response = response;
				error.url      = url;
				throw error;
			}
		} );
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
	 */
	checkToken()
	{
		let infoURL = this.urls.info;

		return this.fetch( infoURL.url, infoURL.method ).then( response =>
		{
			let display_name = '';

			// Support for nested objects (name.display_name)
			let namePath = this.responseKeys.display_name.split( '.' );

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
		} );
	}

	/**
	 * Lists all the files/folders in a cloud services.
	 * @param {String} path Required. Path/ID of the folder to be loaded.
	 * @param {String} [recursive] Is this function being used in a recursive way to load all files in depth.
	 */
	getFolderContents( path, recursive )
	{
		// Empty the window and create "up" element only if call to getFolderContents is not being used by addFolder
		if ( !recursive )
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

				// If we use ids we need to get the id of the parent folder (up button) from the cloud
				if ( this.usesIds )
				{
					up = n.addItemToWindow( toAdd );

					// 10 retries for this request.
					//TODO: Make this 10 iterations a CONST and use it everywhere
					asyncLoop( 10, loop => this.fetch( this.urls.folder.replace( '{{path}}', path ) ).then( response =>
					{
						if ( response.parents.length )
						{
							up.dataset.path = response.parents[ 0 ].id;
						}
						else
						{
							up.remove();
						}
					} ).catch( _ =>
					{
						n.log( 'connection-retry', loop.index );
						n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
						loop.next();
					} ) ).then( _ =>
					{
						n.setFooter( null, true );
						n.error( 'cannot-load-url', this.urls.folder );
					} );
				}
				// Otherwise we know the path for previous folder so we just render it
				else
				{
					n.addItemToWindow( toAdd );
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

		return this.fetch( queryURL.url.replace( '{{path}}', path ), queryURL.method, body, queryURL.headers ).then( response =>
		{
			let files   = [];
			let folders = [];

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

			if ( recursive )
			{
				return Promise.resolve( { files, folders } );
			}

			folders.forEach( n.addItemToWindow );

			files.forEach( n.addItemToWindow );

			n.applyWindowState( 'semi' );

			document.getElementById( 'loading-folder-contents' ).classList.add( 'visibility-hidden' );
		} );
	}

	/**
	 * Loads playlist or preferences from the cloud.
	 * @param {HTMLElement} item Required. Item chosen by the user to be loaded.
	 */
	loadNoisyFile( item )
	{
		// Google Drive has the loadPlaylist URL saved in the DOM, as data-downloadURL
		let loadPlaylistURL = this.urls.loadPlaylist || {};
		let headers         = {};
		let url             = this.usesIds ? item.dataset.downloadURL : loadPlaylistURL.url;

		Object.keys( loadPlaylistURL.headers || {} ).forEach( header =>
		{
			headers[ header ] = loadPlaylistURL.headers[ header ].replace( '{{path}}', item.dataset.path );
		} );

		return new Promise( resolve => asyncLoop( 10, loop => this.fetch( url, loadPlaylistURL.method || 'GET', '', headers )
			.then( resolve ).catch( _ =>
			{
				n.log( 'connection-retry', loop.index );
				n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
				loop.next();
			} )
		).then( _ =>
		{
			n.setFooter( null, true );
			n.error( 'cannot-load-url', url );
		} ) );
	}

	_preload( url, item )
	{
		n.setItemState( 'w', false, item );

		asyncLoop( 10, loop =>
		{
			this.fetch( url, 'GET', void 0, {}, 'arraybuffer' ).then( buffer =>
			{
				let extension = item.dataset.placeholder.split( '.' ).pop();
				let mimeType  = 'unknown';

				switch ( extension )
				{
					case 'mp3':
						mimeType = 'audio/mpeg';
						break;
					case 'ogg':
					case 'opus':
						mimeType = 'audio/ogg';
						break;
					case 'm4a':
						mimeType = 'audio/mp4';
						break;
					case 'wav':
						mimeType = 'audio/wav';
						break;
				}

				// Read tags if not in Power Save mode
				if ( !n.powerSaveMode )
				{
					const icon = item.querySelector( '.playback-status' ).dataset.icon;

					// Show loading indicator when reading tags
					n.setItemState( 'w', false, item, false );

					n.readTags( buffer, extension ).then( tags =>
					{
						// Hide loading indicator if it was loading, but keep it otherwise (play)
						n.setItemState( icon !== 'w' ? icon : null, false, item, false );

						// Update tags
						n.updateItemTags( tags, item );
					} );
				}

				// Check if current item is supported by the browser
				if ( mimeType && !n.formats.includes( mimeType ) )
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

				audio.addEventListener( 'loadedmetadata', _ =>
				{
					// Set duration to the item, so we can save it later
					// Format duration using toHHMMSS() method defined in main.js
					item.dataset.duration = Math.floor( audio.duration ).toString().toHHMMSS();

					audio.remove();

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
					(0 === n.audio.currentTime || n.audio.currentTime === n.audio.duration) &&
					n.audio.dataset.item )
				{
					n[ item.dataset.cloud ].play( item );
				}
			} ).catch( _ =>
			{
				n.log( 'connection-retry', loop.index );
				n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
				loop.next();
			} );
		} ).then( _ =>
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
					this.fetch( url, playURL.method, body, playURL.headers ).then( response =>
					{
						item.dataset.tempurl = this.usesIds ? response.downloadUrl : response.link;
						item.dataset.expires = response.expires ? response.expires : new Date( Date.now() + 14400000 );

						n.saveActivePlaylist();

						this._preload( item.dataset.tempurl, item );
					} ).catch( _ =>
					{
						n.log( 'connection-retry', loop.index );
						n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
						loop.next();
					} );
				} ).then( _ =>
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
			let items = item.closest( '.playlist' ).querySelectorAll( '.playlist-item' );

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
				this.fetch( url, playURL.method, body, playURL.headers ).then( response =>
				{
					item.dataset.tempurl = this.usesIds ? response.downloadUrl.replace( '&gd=true', '' ) : response.link;
					item.dataset.expires = response.expires ? response.expires : new Date( Date.now() + 14400000 );

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
				} ).catch( _ =>
				{
					n.log( 'connection-retry', loop.index );
					n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
					loop.next();
				} );
			} ).then( _ =>
			{
				n.setFooter( null, true );
				n.error( 'cannot-load-url', url );
			} );
		}
	}

	/**
	 * Saves the active playlist or preferences to the cloud.
	 * @param {String} file Filename of the playlist/preferences file being saved.
	 * @param {String} path Path to the file in which the playlist/preferences will be saved.
	 */
	saveNoisyFile( file, path )
	{
		let toSave;
		let type;

		if ( file.endsWith( '.plst.nsy' ) )
		{
			toSave = n.saveActivePlaylist( true );
			type   = 'playlist';
		}
		else
		{
			toSave = n.pref.export();
			type   = 'preferences';
		}

		if ( toSave )
		{
			toSave.type = type;

			let savePlaylistURL = this.urls.savePlaylist;
			let headers         = {};
			let savePath        = `${path}/${file}`.replace( '//', '/' );
			let url             = savePlaylistURL.url.replace( '{{path}}', savePath );

			Object.keys( savePlaylistURL.headers || {} ).forEach( header =>
			{
				headers[ header ] = savePlaylistURL.headers[ header ].replace( '{{path}}', savePath );
			} );

			asyncLoop( 10, loop => this.fetch( url, 'POST', JSON.stringify( toSave ), headers ).then( response =>
				{
					if ( this.usesIds )
					{
						url = this.urls.savePlaylist2.replace( '{{path}}', response.id );

						asyncLoop( 10, loop => this.fetch( url, 'PUT', `{"title":"${file}","parents":[{"id":"${path}"}]}`, { 'Content-Type': 'application/json' } ).then( _ =>
							{
								n.log( 'saved', url );
								n.setFooter( n.lang.footer[ 'operation-successful' ] );
							} ).catch( _ =>
							{
								n.log( 'connection-retry', loop.index );
								n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
								loop.next();
							} )
						).then( _ =>
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
				} ).catch( _ =>
				{
					n.log( 'connection-retry', loop.index );
					n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
					loop.next();
				} )
			).then( _ =>
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