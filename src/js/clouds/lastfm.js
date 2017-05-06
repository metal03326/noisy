/**
 * Noisy communication module for Last.fm
 *
 * @author metal03326
 * @version 20170506
 */

// Last.fm singleton to be passed to Noisy
var lastfm = new Cloud( {
	name: 'Last.fm',

	apiKey: '72e8177b21934e08c11195b8e559c925',
	apiSecret: 'c11941c36875f14d1dfe392848a43685',

	urls: {
		connect: "//www.last.fm/api/auth/?api_key="
	},

	queue: {
		q: {},

		reset: function()
		{
			this.q = {};
			this.save();
			n.updateScrobbleCounter();
		},

		add: function()
		{
			if( lastfm.isAuthenticated && n.pref.scrobbling && n.audio.dataset.playlist )
			{
				var item = document.getElementById( n.audio.dataset.playlist ).getElementsByClassName( 'playlist-item' )[ n.audio.dataset.item ];
				if( item )
				{
					var duration = n.audio.duration;
					//				var position = n.audio.currentTime;
					var position = +new Date() / 1000 - parseInt( n.audio.dataset.start, 10 );
					// Decrease position with one second if the duration is less. This may happen as a calculation error,
					// which is less than a second, so we compensate here
					if( position > duration )
					{
						position = duration;
					}

					// Last.fm requires a minimum of 30 seconds and 50% to be passed from the song before scrobbling
					var neededPosition = Math.max( 30, duration * parseInt( n.pref.settings.values[ 'preference-scrobbling-position' ], 10 ) / 100 );
					if( position >= neededPosition )
					{
						var count = Object.keys( this.q ).length;

						// Last.fm allows a maximum of 50 songs to be scrobbled at one call to track.scrobble, so we limit
						// the user to maximum of 50 songs in the queue
						if( 50 > count )
						{
							var artist = item.dataset.artist,
								title = item.dataset.title,
								timestamp = n.audio.dataset.start;

							if( artist && title && timestamp )
							{
								// Check if we already have an item to scrobble for this timestamp
								var exists = false;
								for ( var q in this.q )
								{
									if ( this.q[ q ].timestamp == timestamp )
									{
										exists = true;
										break;
									}
								}

								// Add the item if unique
								if( !exists )
								{
									this.q[ count ] = {
										artist: artist,
										track: title,
										timestamp: timestamp
									};
									this.save();
									n.updateScrobbleCounter();
									this.process();
								}
							}
						}
					}
				}
			}
		},

		process: function()
		{
			if( lastfm.isAuthenticated )
			{
				var keys = Object.keys( this.q ),
					artists = '',
					artistsEq = '',
					method = 'track.scrobble',
					timestamps = '',
					timestampsEq = '',
					tracks = '',
					tracksEq = '';

				// Proceed only if we have at least one item to scrobble
				if( keys.length )
				{
					keys.sort();

					for( var i = 0; i < keys.length; i++ )
					{
						artists += 'artist['.concat( i, ']', this.q[ i ].artist );
						artistsEq += '&artist['.concat( i, ']=', encodeURIComponent( this.q[ i ].artist ) );
						timestamps += 'timestamp['.concat( i, ']', this.q[ i ].timestamp );
						timestampsEq += '&timestamp['.concat( i, ']=', this.q[ i ].timestamp );
						tracks += 'track['.concat( i, ']', this.q[ i ].track );
						tracksEq += '&track['.concat( i, ']=', encodeURIComponent( this.q[ i ].track ) );
					}

					var params = 'api_key='.concat( lastfm.apiKey,
						'&api_sig=', hex_md5( 'api_key'.concat( lastfm.apiKey, artists, 'method', method, 'sk', lastfm.accessToken, timestamps, tracks, lastfm.apiSecret ) ),
						artistsEq,
						'&format=json',
						'&method=', method,
						'&sk=', lastfm.accessToken,
						timestampsEq,
						tracksEq
					);

					lastfm.ajaxRequest( '//ws.audioscrobbler.com/2.0/?' + params,
						function()
						{
							//TODO: Make an option for the user to accept last.fm's corrections on artist/song names
							lastfm.queue.reset();

						}, function()
						{
						}, 'POST', params );
				}
			}
		},

		save: function()
		{
			localStorage.setItem( 'lastfm-queue', JSON.stringify( this.q ) );
		},

		load: function()
		{
			var loaded = localStorage.getItem( 'lastfm-queue' );
			if( loaded )
			{
				this.q = JSON.parse( loaded );
			}
		}
	},

	/**
	 * Gets the access token from Last.fm servers.
	 * @param {String} token Required. Token got from the connect().
	 * @param {Function} successCallback Required. Function to be called if the access token is successfuly received.
	 * @param {Function} failureCallback Required. Function to be called if there is a problem with the access token.
	 */
	getAccessToken: function( token, successCallback, failureCallback )
	{
		this.ajaxRequest( '//ws.audioscrobbler.com/2.0/?method=auth.getSession&format=json&token=' + token + '&api_key=' + this.apiKey + '&api_sig=' + hex_md5( "api_key" + this.apiKey + "methodauth.getSessiontoken" + token + 'c11941c36875f14d1dfe392848a43685' ), successCallback, failureCallback );
	},

	/**
	 * Tokens in last.fm do not expire. So we check if we can get info for our user. If we have user, then we should have a valid token.
	 * @param {Function} successCallback Required. Function to be called if access token is valid.
	 * @param {Function} failureCallback Required. Function to be called if access token is invalid.
	 */
	//TODO: Find a way to verify token.
	checkToken: function( successCallback, failureCallback )
	{
		var self = this;
		this.ajaxRequest( '//ws.audioscrobbler.com/2.0/?method=user.getinfo&format=json&user=' + this.userName + '&api_key=72e8177b21934e08c11195b8e559c925', function( xhr )
		{
			var response = JSON.parse( xhr.responseText ),
				username = response.user.name;
			if( 'undefined' == username )
			{
				failureCallback( self, xhr );
			}
			else
			{
				self.display_name = username;
				successCallback( self );
			}
		}, function( xhr )
		{
			failureCallback( self, xhr );
		} );
	},

	/**]
	 * Sends request to last.fm to update the Now listening status of the user.
	 * @param {HTMLElement} item Required. Playlist item from which to read the information to be sent to last.fm.
	 */
	updateNowPlaying: function( item )
	{
		if( n.pref.scrobbling )
		{
			var artist = item.dataset.artist,
				title = item.dataset.title,
				method = 'track.updateNowPlaying';

			if( artist && title )
			{
				var params = 'api_key='.concat( this.apiKey,
					'&api_sig=', hex_md5( 'api_key'.concat( this.apiKey, 'artist', artist, 'method', method, 'sk', this.accessToken, 'track', title, this.apiSecret ) ),
					'&artist=', artist,
					'&format=json',
					'&method=', method,
					'&sk=', this.accessToken,
					'&track=', title
				);

				this.ajaxRequest( '//ws.audioscrobbler.com/2.0/?' + params,
					function( xhr )
					{
						//TODO: Make an option for the user to accept last.fm's corrections on artist/song names
					}, function()
					{
					}, 'POST', '' );
			}
		}
	},

	/**
	 * Sends request to last.fm to scrobble the item loaded in n.audio
	 */
	scrobble: function()
	{
		if( n.pref.scrobbling && ! n.powerSaveMode )
		{
			this.queue.add();
		}
	}
} );

// Append API key to the URL so we don't repeat it everywhere
lastfm.urls.connect += lastfm.apiKey;

// Load saved queue from localStorage
lastfm.queue.load();