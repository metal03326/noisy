/**
 * Noisy Preferences module for data binding between the DOM and the preferences object
 *
 * @author metal03326
 * @version 20170721
 */

// Preferences singleton to be passed to Noisy
let pref = {
	// Load method will save the original settings here, to be used later if user wants to reset to defaults
	originalSettings: null,

	// Default settings
	settings: {
		//todo: Join values and checkboxes and use Object.values() with typeof to figure out if it's a checkbox or not
		values                       : {
			'preference-user-language'            : 'en',
			'preference-theme'                    : 'default',
			'preference-scrobbling-position'      : '50',
			'preference-notification-popup-format': '%artist% - %title%',
			'preference-status-bar-format'        : '%artist% - %title%',
			'preference-window-title-format'      : '%artist% - %title%',
			'preference-playlist-format'          : '%artist% - %title%'
		},
		checkboxes                   : {
			'preference-enable-notifications'   : false,
			'preference-enable-counter'         : true,
			'preference-enable-animations'      : true,
			'preference-enable-scrobbling'      : true,
			'preference-hide-playlist-tabs'     : false,
			'preference-playback-follows-cursor': false,
			'preference-cursor-follows-playback': false
		},
		[ `showWhatsNew-${version}` ]: true,
		keys                         : [
			{ key: '17+81', action: 'addToQueue' },
			{ key: '81', action: 'addToQueue' },
			{ key: '74', action: 'showSearch' },
			{ key: '66', action: 'next' },
			{ key: '86', action: 'stop' },
			{ key: '67', action: 'playPause' },
			{ key: '88', action: 'play' },
			{ key: '90', action: 'prev' },
			{ key: '17+38', action: 'volumeUp' },
			{ key: '17+40', action: 'volumeDown' },
			{ key: '77', action: 'toggleMute' },
			{ key: '46', action: 'removeFromPlaylist' }
		],
		volume                       : 1,
		activePlaylistId             : null,
		muted                        : false,
		playbackOrder                : 0,
		powerSaver                   : false,
		dropbox                      : { accessToken: null },
		googledrive                  : { accessToken: null },
		lastfm                       : { accessToken: null }
	},

	save()
	{
		localStorage.setItem( 'preferences', JSON.stringify( this.settings ) );
	},

	load()
	{
		this.originalSettings = JSON.parse( JSON.stringify( this.settings ) );

		let settings = localStorage.getItem( 'preferences' );

		if ( settings )
		{
			this.settings = Object.assign( {}, this.originalSettings, JSON.parse( settings ) );
		}

		this.clean( [ `showWhatsNew-${version}` ] );
	},

	/**
	 * Removes old, unused settings
	 * @param {Array} [exceptionList] List of exact key names that needs to be kept
	 */
	clean( exceptionList = [] )
	{
		let removeExact = [ 'devChannel', 'showWelcome', 'preference-enable-powersaver', 'power-saver-state' ];
		let removeRegEx = [ 'showWhatsNew' ];

		removeExact.forEach( key =>
		{
			if ( !exceptionList.includes( key ) )
			{
				delete this.settings[ key ];
				delete this.settings.values[ key ];
				delete this.settings.checkboxes[ key ];
			}
		} );

		let settingsKeys = Object.keys( this.settings );

		removeRegEx.forEach( removeKey =>
		{
			settingsKeys.forEach( key =>
			{
				if ( !exceptionList.includes( key ) && key.match( new RegExp( removeKey ) ) )
				{
					delete this.settings[ key ];
					delete this.settings.values[ key ];
					delete this.settings.checkboxes[ key ];
				}
			} );
		} );
	},

	'import'( settings )
	{
		this.settings = settings;
		this.save();
	},

	'export'()
	{
		return this.settings;
	},

	process()
	{
		// Load all elements that have it's values stored in .value property
		let inputs = this.settings.values;

		Object.keys( inputs ).forEach( input =>
		{
			let inputEl = document.getElementById( input );

			if ( inputEl )
			{
				inputEl.value = this.settings.values[ input ];
			}
			else
			{
				n.warn( 'missing-element', input );
			}
		} );

		// Load all elements that have it's values stored in .checked property
		let checkboxes = this.settings.checkboxes;

		Object.keys( checkboxes ).forEach( checkbox =>
		{
			let checkboxEl = document.getElementById( checkbox );

			if ( checkboxEl )
			{
				checkboxEl.checked = this.settings.checkboxes[ checkbox ];
			}
			else
			{
				n.warn( 'missing-element', checkbox );
			}
		} );

		// Render loaded keyboard shortcuts into the table in preferences window
		n.renderKeyboardShortcuts();

		// Set volume to loaded value or to maximum if no saved value found
		n.audio.volume = this.settings.volume;

		// Set mute state depending on loaded value
		n.audio.muted = this.settings.muted;

		// Make sure button has the proper state when loading preferences;
		this.powerSaver = this.settings.powerSaver;

		n.updateVolumeState();

		// Load playback order
		let playbackOrder = document.getElementById( 'playback-order' );

		if ( playbackOrder )
		{
			const idx                   = this.settings.playbackOrder || 0;
			playbackOrder.selectedIndex = idx;
			n.audio.loop                = !(2 - idx);
		}
		else
		{
			n.warn( 'missing-element', 'playback-order' );
		}

		// Set whats new window state
		document.getElementById( 'show-on-startup-checkbox' ).checked = this.settings[ `showWhatsNew-${version}` ];

		// Set Dropbox access token to loaded value
		n.dropbox.accessToken = this.settings.dropbox.accessToken;

		// Set Google Drive access token to loaded value
		n.googledrive.accessToken = this.settings.googledrive.accessToken;

		// Set Last.fm access token to loaded value
		n.lastfm.accessToken = this.settings.lastfm.accessToken;
		n.lastfm.userName    = this.settings.lastfm.userName;

		// Disable counter update if user said so
		if ( !this.counter )
		{
			document.getElementById( 'footer-counter' ).hidden = true;
		}
	},

	set playbackOrder( value )
	{
		let shouldSave              = this.settings.playbackOrder !== value;
		this.settings.playbackOrder = value;

		if ( shouldSave )
		{
			this.save();
		}
	},

	set key( object )
	{
		this.settings.keys.push( object );
		this.save();
	},

	get keys()
	{
		return this.settings.keys;
	},

	set deleteKey( idx )
	{
		this.settings.keys.splice( idx, 1 );

		this.save();
	},

	set input( input )
	{
		let shouldSave;

		if ( 'checkbox' === input.type )
		{
			shouldSave = this.settings.checkboxes[ input.id ] !== input.checked;

			this.settings.checkboxes[ input.id ] = input.checked;
		}
		else
		{
			shouldSave = this.settings.values[ input.id ] !== input.value;

			this.settings.values[ input.id ] = input.value;
		}

		if ( shouldSave )
		{
			this.save();
		}
	},

	set showWhatsNew( value )
	{
		let shouldSave = this.settings[ `showWhatsNew-${version}` ] !== value;

		this.settings[ `showWhatsNew-${version}` ] = value;

		if ( shouldSave )
		{
			this.save();
		}
	},

	get showWhatsNew()
	{
		return this.settings[ `showWhatsNew-${version}` ];
	},

	set lang( value )
	{
		let currentLang = this.settings.values[ 'preference-user-language' ] || 'en';

		this.settings.values[ 'preference-user-language' ] = value;

		if ( currentLang !== value )
		{
			this.save();
		}
	},

	get lang()
	{
		return this.settings.values[ 'preference-user-language' ] || 'en';
	},

	set theme( value )
	{
		let shouldSave = this.settings.values[ 'preference-theme' ] !== value;

		this.settings.values[ 'preference-theme' ] = value;

		if ( shouldSave )
		{
			this.save();
		}
	},

	set accessToken( object )
	{
		// Some clouds, like last.fm, have to fetch accessToken with an additional call. This is why we have
		// accessToken as Promise - once it resolves, we'll get the real token.
		let shouldSave = this.settings[ object.cloud ].accessToken !== object.accessToken && object.accessToken.constructor !== Promise;

		this.settings[ object.cloud ].accessToken = object.accessToken;

		if ( shouldSave )
		{
			this.save();
		}
	},

	set activePlaylistId( value )
	{
		this.settings.activePlaylistId = value;

		if ( value )
		{
			this.scrollTop = document.getElementById( value ).scrollTop;
		}
		else
		{
			delete this.settings.scrollTop;
		}

		this.save();
	},

	get activePlaylistId()
	{
		return this.settings.activePlaylistId;
	},

	set scrollTop( value )
	{
		let shouldSave = this.settings.scrollTop !== value;

		this.settings.scrollTop = value;

		if ( shouldSave )
		{
			this.save();
		}
	},

	get scrollTop()
	{
		return this.settings.scrollTop;
	},

	set tokenCloud( value )
	{
		let shouldSave = this.settings.tokenCloud !== value;

		this.settings.tokenCloud = value;

		if ( shouldSave )
		{
			this.save();
		}
	},

	get tokenCloud()
	{
		return this.settings.tokenCloud;
	},

	set userName( object )
	{
		let shouldSave = this.settings[ object.cloud ].userName !== object.userName;

		this.settings[ object.cloud ].userName = object.userName;

		if ( shouldSave )
		{
			this.save();
		}
	},

	set muted( value )
	{
		let shouldSave = this.settings.muted !== value;

		this.settings.muted = value;
		n.audio.muted       = value;

		n.updateVolumeState();

		if ( shouldSave )
		{
			this.save();
		}
	},

	get powerSaver()
	{
		return this.settings.powerSaver;
	},

	set powerSaver( value )
	{
		const shouldSave = this.settings.powerSaver !== value;

		this.settings.powerSaver = value;

		if ( value )
		{
			// Mark menu item as active
			document.getElementById( 'togglePowerSaver' ).classList.add( 'active' );

			// Add icon in the footer to indicate Power Saver is active
			document.getElementById( 'power-saver-activated' ).dataset.icon = '|';
		}
		else
		{
			// Remove menu highlight
			document.getElementById( 'togglePowerSaver' ).classList.remove( 'active' );

			// Remove icon from footer
			delete document.getElementById( 'power-saver-activated' ).dataset.icon;
		}

		if ( shouldSave )
		{
			this.save();
		}
	},

	set volume( value )
	{
		// Fix 0.7000000000000001 to be 0.7
		value = parseFloat( value.toFixed( 1 ) );

		let shouldSave = this.settings.volume !== value;

		this.settings.volume = value;

		n.audio.muted = this.settings.muted = false;

		n.audio.volume = value;

		n.updateVolumeState();

		if ( shouldSave )
		{
			this.save();
		}
	},

	get scrobbling()
	{
		return this.settings.checkboxes[ 'preference-enable-scrobbling' ];
	},

	get counter()
	{
		return this.settings.checkboxes[ 'preference-enable-counter' ];
	},

	get notify()
	{
		return this.settings.checkboxes[ 'preference-enable-notifications' ];
	},

	get cursorFollowsPlaybackEnabled()
	{
		return this.settings.checkboxes[ 'preference-cursor-follows-playback' ];
	},

	get playbackFollowsCursorEnabled()
	{
		return this.settings.checkboxes[ 'preference-playback-follows-cursor' ];
	}
};

// Load the preferences from localStorage
pref.load();