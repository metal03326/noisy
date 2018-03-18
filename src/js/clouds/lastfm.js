/**
 * Noisy communication module for Last.fm
 *
 * @author metal03326
 * @version 20170507
 */

// Last.fm singleton to be passed to Noisy
let lastfm = new Cloud( {
	name: 'Last.fm',

	get apiKey()
	{
		return location.hostname === 'localhost' ? '9d7f26c9783e4e08ee455ec3129830ce' : '72e8177b21934e08c11195b8e559c925';
	},
	get apiSecret()
	{
		return location.hostname === 'localhost' ? '8f649f54488224c2d056dc40ec3a12d1' : 'c11941c36875f14d1dfe392848a43685';
	},

	urls: {
		connect: '//www.last.fm/api/auth/?api_key='
	},

	queue: {
		q: new Map(),

		// last.fm doesn't allow more than 50 songs scrobbled in one request
		maxSize: 50,

		reset()
		{
			this.q.clear();
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
						// Remove the first item from queue in order to save the new one
						if ( this.maxSize <= this.q.size )
						{
							const [ key, value ] = this.q.entries().next().value;

							n.warn( 'lastfm-queue-overflow', n.formatString( document.getElementById( 'preference-playlist-format' ).value, {
								dataset: {
									artist: value.artist,
									title : value.track
								}
							} ) );

							this.q.delete( key );
						}

						let { artist, title } = item.dataset;
						let timestamp         = n.audio.dataset.start;

						if ( artist && title && timestamp )
						{
							// Add the item if unique
							if ( !this.q.has( timestamp ) )
							{
								this.q.set( timestamp, {
									artist,
									track: title,
									timestamp
								} );

								this.save();
								n.updateScrobbleCounter();
								this.process();
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
				let keys         = [ ...this.q.keys() ];
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
					// last.fm wants params ordered alphabetically, which means [1] will be after [10], thus we need to
					// sort them like so without losing the original key, as it's the only connection to the data in
					// the Map. This is why we create a new key, which is string (easily sortable), starting with
					// [number] and having the original key after "-" separator.
					keys.map( ( key, i ) => `[${i}]-${key}` ).sort().forEach( pair =>
					{
						// Split the pair into its components
						pair = pair.split( '-' );

						// Fist part in the pair is the sorted [number]
						const i = pair[ 0 ];

						// Second part of of the pair is the key in the Map
						const q = this.q.get( pair[ 1 ] );

						artists += `artist${i}${q.artist}`;
						artistsEq += `&artist${i}=${encodeURIComponent( q.artist )}`;
						timestamps += `timestamp${i}${q.timestamp}`;
						timestampsEq += `&timestamp${i}=${q.timestamp}`;
						tracks += `track${i}${q.track}`;
						tracksEq += `&track${i}=${encodeURIComponent( q.track )}`;
					} );

					let params = `api_key=${lastfm.apiKey}&api_sig=${hex_md5( `api_key${lastfm.apiKey}${artists}method${method}sk${lastfm.accessToken}${timestamps}${tracks}${lastfm.apiSecret}` )}${artistsEq}&format=json&method=${method}&sk=${lastfm.accessToken}${timestampsEq}${tracksEq}`;

					lastfm.fetch( `//ws.audioscrobbler.com/2.0/?${params}`, 'POST' ).then( lastfm.queue.reset.bind( lastfm.queue ) );
				}
			}
		},

		save()
		{
			localStorage.setItem( 'lastfm-queue', JSON.stringify( [ ...this.q ] ) );
		},

		load()
		{
			let loaded = localStorage.getItem( 'lastfm-queue' );

			if ( loaded )
			{
				this.q = new Map( JSON.parse( loaded ) );
			}
		}
	},

	/**
	 * Gets the access token from Last.fm servers.
	 * @param {String} token Required. Token got from the connect().
	 */
	getAccessToken( token )
	{
		return this.fetch( `//ws.audioscrobbler.com/2.0/?method=auth.getSession&format=json&token=${token}&api_key=${this.apiKey}&api_sig=${hex_md5( `api_key${this.apiKey}methodauth.getSessiontoken${token}${this.apiSecret}` )}` );
	},

	/**
	 * Tokens in last.fm do not expire. So we check if we can get info for our user. If we have user, then we should
	 * have a valid token.
	 */
	//TODO: Find a way to verify token.
	checkToken()
	{
		return this.fetch( `//ws.audioscrobbler.com/2.0/?method=user.getinfo&format=json&user=${this.userName}&api_key=${this.apiKey}` ).then( response =>
		{
			let username = response.user.name;

			if ( 'undefined' === username )
			{
				throw new Error( 'No username' );
			}
			else
			{
				this.display_name = username;
			}
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

				this.fetch( `//ws.audioscrobbler.com/2.0/?${params}`, 'POST' );
			}
		}
	},

	/**
	 * Sends request to last.fm to scrobble the item loaded in n.audio
	 */
	scrobble()
	{
		if ( n.pref.scrobbling && !n.pref.powerSaver )
		{
			this.queue.add();
		}
	}
} );

// Append API key to the URL so we don't repeat it everywhere
lastfm.urls.connect += lastfm.apiKey;

// Load saved queue from localStorage
lastfm.queue.load();