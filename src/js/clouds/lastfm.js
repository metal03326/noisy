/**
 * Noisy communication module for Last.fm
 *
 * @author metal03326
 * @version 20170507
 */

// Last.fm singleton to be passed to Noisy
let lastfm = new Cloud( {
	name: 'Last.fm',

	apiKey   : '72e8177b21934e08c11195b8e559c925',
	apiSecret: 'c11941c36875f14d1dfe392848a43685',

	urls: {
		connect: '//www.last.fm/api/auth/?api_key='
	},

	queue: {
		q: {},

		reset()
		{
			this.q = {};
			this.save();
			n.updateScrobbleCounter();
		},

		add()
		{
			if ( lastfm.isAuthenticated && n.pref.scrobbling && n.audio.dataset.playlist )
			{
				let item = document.getElementById( n.audio.dataset.playlist ).querySelectorAll( '.playlist-item' )[ n.audio.dataset.item ];

				if ( item )
				{
					let duration = n.audio.duration;
					let position = Date.now() / 1000 - parseInt( n.audio.dataset.start, 10 );

					// Decrease position with one second if the duration is less. This may happen as a calculation
					// error, which is less than a second, so we compensate here
					if ( position > duration )
					{
						position = duration;
					}

					// Last.fm requires a minimum of 30 seconds and 50% to be passed from the song before scrobbling
					let neededPosition = Math.max( 30, duration * parseInt( n.pref.settings.values[ 'preference-scrobbling-position' ], 10 ) / 100 );

					if ( position >= neededPosition )
					{
						let count = Object.keys( this.q ).length;

						// Last.fm allows a maximum of 50 songs to be scrobbled at one call to track.scrobble, so we
						// limit the user to maximum of 50 songs in the queue
						if ( 50 > count )
						{
							let { artist, title } = item.dataset;
							let timestamp         = n.audio.dataset.start;

							if ( artist && title && timestamp )
							{
								// Check if we already have an item to scrobble for this timestamp
								let exists = false;

								for ( let q in this.q )
								{
									if ( this.q.hasOwnProperty( q ) && this.q[ q ].timestamp === timestamp )
									{
										exists = true;
										break;
									}
								}

								// Add the item if unique
								if ( !exists )
								{
									this.q[ count ] = {
										artist,
										track: title,
										timestamp
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

		process()
		{
			if ( lastfm.isAuthenticated )
			{
				let keys         = Object.keys( this.q );
				let artists      = '';
				let artistsEq    = '';
				let method       = 'track.scrobble';
				let timestamps   = '';
				let timestampsEq = '';
				let tracks       = '';
				let tracksEq     = '';

				// Proceed only if we have at least one item to scrobble
				if ( keys.length )
				{
					keys.sort();

					keys.forEach( ( key, i ) =>
					{
						let q = this.q[ i ];

						artists += `artist[${i}]${q.artist}`;
						artistsEq += `&artist[${i}]=${encodeURIComponent( q.artist )}`;
						timestamps += `timestamp[${i}]${q.timestamp}`;
						timestampsEq += `&timestamp[${i}]=${q.timestamp}`;
						tracks += `track[${i}]${q.track}`;
						tracksEq += `&track[${i}]=${encodeURIComponent( q.track )}`;
					} );

					let params = `api_key=${lastfm.apiKey}&api_sig=${hex_md5( `api_key${lastfm.apiKey}${artists}method${method}sk${lastfm.accessToken}${timestamps}${tracks}${lastfm.apiSecret}` )}${artistsEq}&format=json&method=${method}&sk=${lastfm.accessToken}${timestampsEq}${tracksEq}`;

					lastfm.ajaxRequest( `//ws.audioscrobbler.com/2.0/?${params}`,
						() =>
						{
							//TODO: Make an option for the user to accept last.fm's corrections on artist/song names
							lastfm.queue.reset();

						}, () =>
						{
						}, 'POST', params );
				}
			}
		},

		save()
		{
			localStorage.setItem( 'lastfm-queue', JSON.stringify( this.q ) );
		},

		load()
		{
			let loaded = localStorage.getItem( 'lastfm-queue' );

			if ( loaded )
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
	getAccessToken( token, successCallback, failureCallback )
	{
		this.ajaxRequest( `//ws.audioscrobbler.com/2.0/?method=auth.getSession&format=json&token=${token}&api_key=${this.apiKey}&api_sig=${hex_md5( `api_key${this.apiKey}methodauth.getSessiontoken${token}c11941c36875f14d1dfe392848a43685` )}`, successCallback, failureCallback );
	},

	/**
	 * Tokens in last.fm do not expire. So we check if we can get info for our user. If we have user, then we should
	 * have a valid token.
	 * @param {Function} successCallback Required. Function to be called if access token is valid.
	 * @param {Function} failureCallback Required. Function to be called if access token is invalid.
	 */
	//TODO: Find a way to verify token.
	checkToken( successCallback, failureCallback )
	{
		this.ajaxRequest( `//ws.audioscrobbler.com/2.0/?method=user.getinfo&format=json&user=${this.userName}&api_key=72e8177b21934e08c11195b8e559c925`, xhr =>
		{
			let response = JSON.parse( xhr.responseText );
			let username = response.user.name;

			if ( 'undefined' === username )
			{
				failureCallback( this, xhr );
			}
			else
			{
				this.display_name = username;
				successCallback( this );
			}
		}, xhr =>
		{
			failureCallback( this, xhr );
		} );
	},

	/**]
	 * Sends request to last.fm to update the Now listening status of the user.
	 * @param {HTMLElement} item Required. Playlist item from which to read the information to be sent to last.fm.
	 */
	updateNowPlaying( item )
	{
		if ( n.pref.scrobbling && lastfm.isAuthenticated )
		{
			let { artist, title } = item.dataset;
			let method            = 'track.updateNowPlaying';

			if ( artist && title )
			{
				let params = `api_key=${this.apiKey}&api_sig=${hex_md5( `api_key${this.apiKey}artist${artist}method${method}sk${this.accessToken}track${title}${this.apiSecret}` )}&artist=${artist}&format=json&method=${method}&sk=${this.accessToken}&track=${title}`;

				this.ajaxRequest( `//ws.audioscrobbler.com/2.0/?${params}`,
					xhr =>
					{
						//TODO: Make an option for the user to accept last.fm's corrections on artist/song names
					}, () =>
					{
					}, 'POST', '' );
			}
		}
	},

	/**
	 * Sends request to last.fm to scrobble the item loaded in n.audio
	 */
	scrobble()
	{
		if ( n.pref.scrobbling && !n.powerSaveMode )
		{
			this.queue.add();
		}
	}
} );

// Append API key to the URL so we don't repeat it everywhere
lastfm.urls.connect += lastfm.apiKey;

// Load saved queue from localStorage
lastfm.queue.load();