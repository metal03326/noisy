/**
 * Noisy communication base module
 *
 * @author metal03326
 * @version 20170506
 */

"use strict";

// Clouds class to use as base for other cloud services
var Cloud = function( options )
{
	var cloud = {
		// Access token returned by OAuth 2.0
		accessToken: null,

		// ObjectUrl manager for CRUD operations with ObjectUrls
		urlManager: urlManager,

		/**
		 * All AJAX calls to all cloud services are made through here.
		 * @param {String} url Required. URL to which to connect.
		 * @param {Function} successCallback Required. Function to be called if the AJAX request is a success.
		 * @param {Function} failureCallback Required. Function to be called if the AJAX request is a failure.
		 * @param {String} method Optional. Request method.
		 * @param {String} body Optional. Request body.
		 * @param {Object} params Optional. Request headers. Key is the header, value is the value.
		 * @param {String} responseType Optional. Request response type.
		 */
		ajaxRequest: function( url, successCallback, failureCallback, method, body, params, responseType )
		{
			method = method || 'GET';
			body = 'undefined' != typeof body ? body : void 0;

			var xhr = new XMLHttpRequest();

			// Make sure the request won't give up
			xhr.timeout = 0;

			xhr.onreadystatechange = function()
			{
				if( 4 === xhr.readyState )
				{
					if( 200 === xhr.status )
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
			if( responseType )
			{
				xhr.responseType = responseType;
			}
			xhr.setRequestHeader( 'Authorization', 'Bearer ' + this.accessToken );
			if( params )
			{
				for( var param in params )
				{
					xhr.setRequestHeader( param, params[ param ] );
				}
			}
			xhr.send( body );
		},

		/**
		 * Parses the name of the cloud service and generates a codename.
		 * @returns {String} codename
		 */
		get codeName()
		{
			return this.name.toLowerCase().replace( / |\./g, '' );
		},

		/**
		 * Connect to cloud service method.
		 */
		connect: function()
		{
			n.pref.tokenCloud = this.codeName;
			location.href = this.urls.connect;
		},

		/**
		 * Checks if cloud token is valied.
		 * @param {Function} successCallback Required. Function to be called if the token is valid.
		 * @param {Function} failureCallback Required. Function to be called if the token is invalid.
		 */
		checkToken: function( successCallback, failureCallback )
		{
			var self = this;
			var infoURL = this.urls.info;
			this.ajaxRequest( infoURL.url, function( xhr )
			{
				var display_name = '';

				// Support for nested objects (name.display_name)
				var namePath = self.responseKeys.display_name.split( '.' );
				var response = JSON.parse( xhr.responseText );

				for ( var i = 0; i < namePath.length; i++ )
				{
					var part = namePath[ i ];

					// If we are the last part of the path to the name, then we should actually be the holder of the name
					if ( i + 1 === namePath.length )
					{
						display_name = response[ part ];
					}
					// Otherwise start digging
					else
					{
						response = response[ part ];
					}
				}

				self.display_name = display_name;
				successCallback( self );
			}, function( xhr )
			{
				failureCallback( self, xhr );
			}, infoURL.method || 'GET' );
		},

		/**
		 * Lists all the files/folders in a cloud services.
		 * @param {String} path Required. Path/ID of the folder to be loaded.
		 * @param {Function} successCallback Optional. Function to be called if folder list was a success.
		 * @param failureCallback Optional. Function to be called if folder list was a failure.
		 */
		getFolderContents: function( path, successCallback, failureCallback )
		{
			var self = this,
				up;
			// Empty window and create "up" element only if call to getFolderContents does not have callbacks (it's not a deep folder listing)
			if( !successCallback )
			{
				n.emptyAddWindow();

				// If we are not loading the root folder
				if( path )
				{
					up = this.rootPath;

					// If current clound isn't using ids, we need to orient ourselves with forward slashes
					if( !this.usesIds )
					{
						up = path.split( '/' );
						up.pop();
						up = up.join( '/' );
					}

					// We need to add .. folder for the user to be able to go back
					var toAdd = {
						cloud: this.codeName,
						name: "..",
						folder: true,
						path: up
					};

					// If we are not using ids, we know the path for previous folder so we just render it
					if( !this.usesIds )
					{
						n.addItemToWindow( toAdd );
					}
					// Otherwise we need to get the id from the cloud
					else
					{
						up = n.addItemToWindow( toAdd );

						// 10 retries for this request.
						//TODO: Make this 10 iterations a CONST and use it everywhere
						asyncLoop( 10, function( loop )
						{
							self.ajaxRequest( self.urls.folder.replace( '{{path}}', path ), function( xhr )
								{
									var resp = JSON.parse( xhr.responseText );
									if( resp.parents.length )
									{
										up.dataset.path = resp.parents[ 0 ].id;
									}
									else
									{
										up.parentNode.removeChild( up );
									}
								},
								function()
								{
									n.log( 'connection-retry', loop.index );
									n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
									loop.next();
								} );
						}, function()
						{
							n.setFooter( null, true );
							n.error( 'cannot-load-url', self.urls.folder );
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

			var window = document.getElementById( 'add-window-files' ),
				filter = window.dataset.filter;

			window.dataset.cloud = this.codeName;

			var queryURL = this.urls.query;
			var body;

			// Dropbox needs the path to be part of the body, not the URL
			if ( queryURL.jsonBody )
			{
			    //todo: Dropbox requires root folder to be empty string. Remove that hack.
                if ( path == '/' )
                {
                    path = '';
                }

				body = queryURL.jsonBody.replace( '{{path}}', path );
			}

			this.ajaxRequest( queryURL.url.replace( '{{path}}', path ), function( xhr )
			{
				var resp = JSON.parse( xhr.responseText ),
					// root = resp.path,
					root = path,
					files = [],
					folders = [],
					len = resp[ self.responseKeys.contents ].length,
					i;

				if( !self.usesIds )
				{
					root = root.split( '/' );
					if( 2 < root.length )
					{
						root = "/" + root.pop() + "/";
					}
					else
					{
						root = root.join( '/' );
					}
				}

				for( i = 0; i < len; i++ )
				{
					var item = resp[ self.responseKeys.contents ][ i ],
						toAdd = {
							cloud: self.codeName,
							// name: self.usesIds ? item[ self.responseKeys.item ] : item[ self.responseKeys.item ].split( root ).pop(),
							name: item[ self.responseKeys.item ],
							// folder: self.usesIds ? !!(item[ self.responseKeys.folder ].indexOf( 'folder' ) > 0) : item[ self.responseKeys.folder ],
							folder: !!~item[ self.responseKeys.folder ].indexOf( 'folder' ),
							path: item[ self.responseKeys.id ? self.responseKeys.id : self.responseKeys.item ]
						};

					if( !self.usesIds && '/' == toAdd.name.charAt( 0 ) )
					{
						toAdd.name = toAdd.name.substring( 1 );
					}

					if( toAdd.folder )
					{
						folders.push( toAdd );
					}
					else if( !filter || ~toAdd.name.lastIndexOf( filter ) )
					{
						if( self.usesIds )
						{
							toAdd.downloadURL = item.downloadUrl;
						}
						files.push( toAdd );
					}
				}

				if( 'function' == typeof successCallback )
				{
					successCallback( files, folders );
					return;
				}

				len = folders.length;
				for( i = 0; i < len; i++ )
				{
					n.addItemToWindow( folders[ i ] );
				}

				len = files.length;
				for( i = 0; i < len; i++ )
				{
					n.addItemToWindow( files[ i ] );
				}
				n.applyWindowState( 'semi' );
				document.getElementById( 'add-window-files' ).classList.remove( 'hidden' );
				document.getElementById( 'loading-folder-contents' ).classList.add( 'visibility-hidden' );
			}, function()
			{
				if( 'function' == typeof failureCallback )
				{
					failureCallback();
				}
			}, queryURL.method || 'GET', body, queryURL.headers );
		},

		/**
		 * Loads playlist from the cloud.
		 * @param {HTMLElement} item Required. Item chosen by the user to be loaded.
		 */
		loadPlaylist: function( item )
		{
			var loadPlaylistURL = this.urls.loadPlaylist;
			var headers = {};
			var url = this.usesIds ? item.dataset.downloadURL : loadPlaylistURL.url,
				self = this;

            for (var header in loadPlaylistURL.headers)
            {
                headers[header] = loadPlaylistURL.headers[header].replace( '{{path}}', item.dataset.path );
            }

			asyncLoop( 10, function( loop )
			{
				self.ajaxRequest( url, function( xhr )
					{
						var response = JSON.parse( xhr.responseText );
						if( "playlist" != response.type )
						{
							throw new Error( 'Not a valid playlist' );
						}
						else
						{
							n.loadPlaylist( response );
							var tab = document.querySelector( 'li[data-for="'.concat( response.id, '"]' ) );
							if( tab )
							{
								n.changePlaylist( tab );
							}
						}
					},
					function()
					{
						n.log( 'connection-retry', loop.index );
						n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
						loop.next();
					}, loadPlaylistURL.method || 'GET', '', headers );
			}, function()
			{
				n.setFooter( null, true );
				n.error( 'cannot-load-url', url );
			} );
		},

		/**
		 * Loads preferences from the cloud.
		 * @param {HTMLElement} item Required. Item chosen by the user to be loaded.
		 */
		loadPreferences: function( item )
		{
            var loadPlaylistURL = this.urls.loadPlaylist;
            var headers = {};
            var url = this.usesIds ? item.dataset.downloadURL : loadPlaylistURL.url,
                self = this;

            for (var header in loadPlaylistURL.headers)
            {
                headers[header] = loadPlaylistURL.headers[header].replace( '{{path}}', item.dataset.path );
            }

			asyncLoop( 10, function( loop )
			{
				self.ajaxRequest( url, function( xhr )
					{
						var response = JSON.parse( xhr.responseText );
						if( "preferences" != response.type )
						{
							throw new Error( 'Not a valid preferences file' );
						}
						else
						{
							delete response.type;
							n.pref.import( response );
						}
					},
					function()
					{
						n.log( 'connection-retry', loop.index );
						n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
						loop.next();
					}, loadPlaylistURL.method || 'GET', '', headers );
			}, function()
			{
				n.setFooter( null, true );
				n.error( 'cannot-load-url', url );
			} );
		},

		preload: function( item )
		{
			var self = this;

			function _preload( url, item )
			{
				n.setItemState( 'w', false, item );
				asyncLoop( 10, function( loop )
				{
					self.ajaxRequest( url, function( xhr )
					{
						var buffer = xhr.response,
							tag,
							extension = item.dataset.placeholder.split( '.' ).pop(),
							mimeType = 'unknown';

						switch( extension )
						{
							case "mp3":
								mimeType = "audio/mpeg";
								break;
							case "ogg":
								mimeType = "audio/ogg";
								break;
							case "m4a":
								mimeType = "audio/mp4";
								break;
							case "wav":
								mimeType = "audio/wav";
								break;
						}

						var metadata = n.powerSaveMode ? {} : n.readTags( buffer, extension );

						for( tag in metadata )
						{
							item.dataset[ tag ] = metadata[ tag ];
						}

						// Check if current item is supported by the browser
						if( mimeType && !~n.formats.indexOf( mimeType ) )
						{
							item.classList.add( 'can-not-play' );
						}

						var blob = new Blob( [buffer], { type: mimeType } );

						var objectUrl = URL.createObjectURL( blob );
						cloud.urlManager.add( item.dataset.url, objectUrl );
						if( document.getElementById( n.audio.dataset.playlist ).getElementsByClassName( 'playlist-item' )[ n.audio.dataset.item ] != item )
						{
							n.setItemState( null, false, item );
						}

						var audio = document.createElement( 'audio' );
						audio.muted = true;

						audio.addEventListener( 'loadedmetadata', function(){
							// Get the duration
							var duration = Math.floor( audio.duration );

							// Format duration using toHHMMSS() method defined in main.js
							duration = duration.toString().toHHMMSS();
							// Set duration to the item, so we can save it later
							item.dataset.duration = duration;
							audio.parentNode.removeChild( audio );

							n.renderItem( item );

							// Save the data
							n.saveActivePlaylist();
						} );

						document.body.appendChild( audio );
						audio.src = objectUrl;
						audio.load();

						var itm = document.getElementById( n.audio.dataset.playlist ).getElementsByClassName( 'playlist-item' )[ parseInt( n.audio.dataset.item, 10 ) ];
						if( itm == item )
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
						if( n.audio.paused && ( 0 == n.audio.currentTime || n.audio.currentTime == n.audio.duration ) && n.audio.dataset.item )
						{
							n[ item.dataset.cloud ].play( item );
						}
					}, function()
					{
						n.log( 'connection-retry', loop.index );
						n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
						loop.next();
					}, 'GET', '', null, 'arraybuffer' );
				}, function()
				{
					n.setFooter( null, true );
					n.error( 'cannot-load-url', url );
				} );
			}

			if( !this.urlManager.get( item.dataset.url ) )
			{
				if( ! this.usesIds && this.isValid( item ) )
				{
					_preload( item.dataset.tempurl, item );
				}
				else
				{
					var playURL = this.urls.play;
                    var body;

                    // Dropbox needs the path to be part of the body, not the URL
                    if ( playURL.jsonBody )
                    {
                        body = playURL.jsonBody.replace( '{{path}}', item.dataset.url );
                    }

					var url = playURL.url.replace( '{{path}}', item.dataset.url );
					asyncLoop( 10, function( loop )
					{
						self.ajaxRequest( url, function( xhr )
						{
							var response = JSON.parse( xhr.responseText );
							item.dataset.tempurl = self.usesIds ? response.downloadUrl : response.link;
							item.dataset.expires = response.expires ? response.expires : new Date( +new Date() + 14400000 );
							n.saveActivePlaylist();
							_preload( item.dataset.tempurl, item );
						}, function()
						{
							n.log( 'connection-retry', loop.index );
							n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
							loop.next();
						}, playURL.method || 'GET', body, playURL.headers );
					}, function()
					{
						n.setFooter( null, true );
						n.error( 'cannot-load-url', url );
					} );
				}
			}
		},

		/**
		 * Loads a file from the cloud and passes it to an audio element for playback.
		 * @param {String} url Required. URL/ID of the file to be loaded.
		 * @param {HTMLElement} item Required. Playlist item which is being loaded.
		 * @private
		 */
		_loadItemFromURL: function( url, item )
		{
			// Show that we are loading an item. Useful for pre-loading
			n.setItemState( 'w', false, item );

			function _loadedMetadata()
			{
				n.audio.removeEventListener( 'loadedmetadata', _loadedMetadata );

				// Reset playback state, as we finished loading
				n.setItemState( null, false, item );

				var itm = document.getElementById( n.audio.dataset.playlist ).getElementsByClassName( 'playlist-item' )[ parseInt( n.audio.dataset.item, 10 ) ];

				// When fast switching items we receive more calls to this handler and we should process only the one that matters
				if( item != itm )
				{
					return;
				}
				// Duration is the only cross-browser supported date we could use
				var duration = Math.floor( n.audio.duration );

				// Format duration using toHHMMSS() method defined in main.js
				duration = duration.toString().toHHMMSS();

				// Set duration to the item, so we can save it later
				item.dataset.duration = duration;

				// Checks for Mozilla's mozGetMetadata() method of the HTML
				// Audio tag and uses it to get more metadata out of the file
				if( 'function' == typeof n.audio.mozGetMetadata && ! n.powerSaveMode )
				{
					var metadata = n.audio.mozGetMetadata();

					for( var prop in metadata )
					{
						item.dataset[ prop.toLowerCase() ] = metadata[ prop ];
					}
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

			var items = item.parentNode.getElementsByClassName( 'playlist-item' );

			// Get the index of the focused item and tell the audio element which item is being played, so we can later get it
			n.audio.dataset.item = Array.prototype.indexOf.call( items, item );
			n.audio.dataset.playlist = item.parentNode.id;

			n.audio.src = url;

			this.preload( item );
		},

		/**
		 * Load file from Dropbox and assign it as a source for the HTML Audio.
		 *
		 * @param {String} item Required. Used to get the URL to the cloud item that should be loaded.
		 */
		play: function( item )
		{
			var self = this;

			// Do nothing if no item to play passed. Happens when there is still item being loaded, but playback finished.
			if( !item )
			{
				return;
			}

			// Check with UrlManager if we already have this file pre-loaded and just play it if we have it
			if( this.urlManager.get( item.dataset.url ) )
			{
				n.lastfm.scrobble();

				var items = item.parentNode.getElementsByClassName( 'playlist-item' );

				// Get the index of the focused item and tell the audio element which item is being played, so we can later get it
				n.audio.dataset.item = Array.prototype.indexOf.call( items, item );
				n.audio.dataset.playlist = item.parentNode.id;

				n.audio.src = this.urlManager.get( item.dataset.url );
				n.audio.load();
			}
			else if( this.isValid( item ) )
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
                var playURL = this.urls.play;
                var body;

                // Dropbox needs the path to be part of the body, not the URL
                if ( playURL.jsonBody )
                {
                    body = playURL.jsonBody.replace( '{{path}}', item.dataset.url );
                }

				var url = playURL.url.replace( '{{path}}', encodeURIComponent( item.dataset.url ) );
				asyncLoop( 10, function( loop )
				{
					self.ajaxRequest( url, function( xhr )
					{
						var response = JSON.parse( xhr.responseText );
						item.dataset.tempurl = self.usesIds ? response.downloadUrl.replace( '&gd=true', '' ) : response.link;
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
						self._loadItemFromURL( item.dataset.tempurl, item );
						//						}
					}, function()
					{
						n.log( 'connection-retry', loop.index );
						n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
						loop.next();
					}, playURL.method || 'GET', body, playURL.headers );
				}, function()
				{
					n.setFooter( null, true );
					n.error( 'cannot-load-url', url );
				} );
			}
		},

		/**
		 * Saves the active playlist to the cloud.
		 * @param {String} file Required. Filename of the playlist file being saved.
		 * @param {String} path Required. Path to the file in which the playlist will be saved.
		 */
		savePlaylist: function( file, path )
		{
			var pst = n.saveActivePlaylist( true ),
				self = this;
			if( pst )
			{
				pst.type = "playlist";

				var savePlaylistURL = this.urls.savePlaylist;
				var headers = {};
				var savePath = (path + '/' + file).replace( '//', '/' );
				var url = savePlaylistURL.url.replace( '{{path}}', savePath );

                for (var header in savePlaylistURL.headers)
                {
                    headers[header] = savePlaylistURL.headers[header].replace( '{{path}}', savePath );
                }

				asyncLoop( 10, function( loop )
				{
                    self.ajaxRequest( url, function( xhr )
					{
						if( self.usesIds )
						{
							var response = JSON.parse( xhr.responseText );
							url = self.urls.savePlaylist2.replace( '{{path}}', response.id );
							asyncLoop( 10, function( loop )
							{
								self.ajaxRequest( url, function()
								{
									n.log( 'saved', url );
									n.setFooter( n.lang.footer[ 'operation-successful' ] );
								}, function()
								{
									n.log( 'connection-retry', loop.index );
									n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
									loop.next();
								}, 'PUT', '{"title":"' + file + '","parents":[{"id":"' + path + '"}]}', { "Content-Type": "application/json" } );
							}, function()
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
					}, function()
					{
						n.log( 'connection-retry', loop.index );
						n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
						loop.next();
					}, 'POST', JSON.stringify( pst ), headers );
				}, function()
				{
					n.error( 'failed-to-save', url );
					n.setFooter( n.lang.footer[ 'error-see-console' ] );
				} );
			}
		},

		/**
		 * Saves the preferences to the cloud.
		 * @param {String} file Required. Filename of the preferences file being saved.
		 * @param {String} path Required. Path to the file in which the preferences will be saved.
		 */
		savePreferences: function( file, path )
		{
			var pref = n.pref.export(),
				self = this;
			if( pref )
			{
				pref.type = "preferences";

                var savePlaylistURL = this.urls.savePlaylist;
                var headers = {};
                var savePath = (path + '/' + file).replace( '//', '/' );
                var url = savePlaylistURL.url.replace( '{{path}}', savePath );

                for (var header in savePlaylistURL.headers)
                {
                    headers[header] = savePlaylistURL.headers[header].replace( '{{path}}', savePath );
                }

				asyncLoop( 10, function( loop )
				{
					self.ajaxRequest( url, function( xhr )
					{
						if( self.usesIds )
						{
							var response = JSON.parse( xhr.responseText );
							url = self.urls.savePlaylist2.replace( '{{path}}', response.id );
							asyncLoop( 10, function( loop )
							{
								self.ajaxRequest( url, function()
								{
									n.log( 'saved', url );
									n.setFooter( n.lang.footer[ 'operation-successful' ] );
								}, function()
								{
									n.log( 'connection-retry', loop.index );
									n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
									loop.next();
								}, 'PUT', '{"title":"' + file + '.plst.nsy"}', { "Content-Type": "application/json" } );
							}, function()
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
					}, function()
					{
						n.log( 'connection-retry', loop.index );
						n.setFooter( n.lang.console[ 'connection-retry' ] + loop.index );
						loop.next();
					}, 'POST', JSON.stringify( pref ), headers );
				}, function()
				{
					n.error( 'failed-to-save', url );
					n.setFooter( n.lang.footer[ 'error-see-console' ] );
				} );
			}
		},

		/**
		 * Checks authentication state.
		 *
		 * @return {Boolean} True if authenticated and false if not.
		 */
		get isAuthenticated()
		{
			return !!this.accessToken;
		},

		/**
		 * Checks if playlist item contains a valid temporary URL.
		 * @param {HTMLElement} item Required. Playlist item to be checked.
		 * @returns {boolean}
		 */
		isValid: function( item )
		{
			var oldDate = new Date(),
				expires = item.dataset.expires;
			if( expires )
			{
				oldDate = new Date( expires );
			}

			return 1 == oldDate > new Date();
		},

		// Whether the cloud service uses id for files/folders or it uses a regular path
		usesIds: false
	};

	// Extend the object with the passed one
	for( var key in options )
	{
		cloud[ key ] = options[ key ];
	}

	return cloud;
};