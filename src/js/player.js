/**
 * Noisy - Your cloud player
 *
 * @author metal03326
 * @version window.version
 */

'use strict';

// Noisy singleton
let n = {
	// Timeout for switching Play/Next buttons to Stop/Next Random
	actionTimeout: null,

	// HTML Audio element which will play files
	audio: document.createElement( 'audio' ),

	// Battery level watcher
	battery: null,

	// Flag rised when adding files/folders to the playlist should be halted
	cancelAction: false,

	// Referance to the console window
	console: document.getElementById( 'console-content' ),

	// Dropbox communication goes through here. See dropbox.js file for more info.
	dropbox,

	// Detected formats that the browser is able to play in Audio tag
	formats: [],

	// Google Drive communication goes through here. See googledrive.js file for more info.
	googledrive,

	// Language cache
	langs: {},

	// Last.fm communication goes through here. See lastfm.js file for more info.
	lastfm,

	// Save last search term, as we need to check for it next time the user presses Enter and initiate play instead of
	// search if terms match
	lastSearchTerm: '',

	// Fake cloud object for local playback
	local: {
		// Object containing all files from user's choise. Format is playlistId: file
		files: {},

		urlManager,

		/**
		 * Show local window instead of actually trying to connect to a cloud
		 */
		getFolderContents()
		{
			n.window( 'local-window' );
			document.getElementById( 'loading-folder-contents' ).classList.add( 'visibility-hidden' );
		},

		// Local playback is always authenticated, as long as the user has added files
		isAuthenticated: true,

		/**
		 * Playing a local file shouldn't send a request
		 * @param {HTMLElement} item Required. Item chosen by the user or Noisy for playback
		 */
		play( item )
		{
			// Try loading the file from the cache
			let url = this.urlManager.get( item.dataset.url );

			// Create ObjectUrl if load failed
			if ( !url )
			{
				// Create ObjectURL from the item
				url = URL.createObjectURL( n.local.files[ item.parentNode.id ][ parseInt( item.dataset.url, 10 ) ] );
				this.urlManager.add( item.dataset.url, url );
			}

			n.lastfm.scrobble();

			n.log( 'playbackWait', item.dataset.placeholder );

			n.setTitle( item );
			n.setFooter( item );

			let items = item.parentNode.querySelectorAll( '.playlist-item' );

			// Get the index of the focused item and tell the audio element which item is being played, so we can later
			// get it
			n.audio.dataset.item     = Array.prototype.indexOf.call( items, item );
			n.audio.dataset.playlist = item.parentNode.id;

			n.audio.src = url;
			n.audio.load();
		},

		/**
		 * Empty function only to avoid errors
		 */
		preload()
		{
		}
	},

	// Holds the item being moved - playlist item or tab, or volume/progress bar
	movingItem: null,

	// Height of the grabbed playlist item. All items should be with the same size
	//TODO: Remove this property by introducing CSS Custom Properties and reading the height of the row from it
	movingItemHeight: -1,

	// Was anything changed? Save?
	movingShouldSave: false,

	// Starting position (either X or Y) at the beginning of the drag or when element (playlist item/tab) swap happens
	movingStart: -1,

	// Shows if Noisy is in power saving mode (meaning the device is not charging and battery level is below the
	// threshold set) or not
	powerSaveMode: false,

	// Preferences object - all preferences are available here
	pref,

	// True when pre-load was initiated
	preloaded: false,

	// Playback queue
	queue: [],

	// JavaScript FileReader which will read file matadata
	reader: null,

	// TImeout when delaying the save of preferences
	saveTimeout: null,

	// Properties that shows if Noisy should refresh a part of itself
	//TODO: Make this an object like refresh:{playlist:0,statusbar:1,title:1}
	shouldRefreshPlaylist   : false,
	shouldRefreshStatusBar  : false,
	shouldRefreshWindowTitle: false,

	// Object containing all loaded themes
	themes: {},

	/**
	 * Deselect all selected items from the current playlist and find window
	 * @private
	 */
	_deselectItems()
	{
		// Find the selected items
		let selected           = document.querySelectorAll( `#${n.activePlaylistId} .selected,.window .selected` );
		let selectedString     = 'selected';
		let confirmationString = 'confirmation';

		// Deselect them
		for ( let i = 0; i < selected.length; i++ )
		{
			let el = selected[ i ];

			el.classList.remove( selectedString );

			// User might have pressed Delete button, thus marking the selected items for removal and them wanting to
			// stop it by deselection
			el.classList.remove( confirmationString );
		}
	},

	/**
	 * Fills a table row for a shortuct. Not local because it's used both for initial creation and for when the user
	 * creates a new one from Preferences
	 * @param {HTMLElement} tr Required. Row to which the information will be inserted
	 * @param {String} dataKey Required. Key combination in it's numering format (17+40)
	 * @param {String} dataAction Required. Action in it's value format (volumeDown)
	 * @param {String} keys Required. Key combination in it's human readable format (Ctrl + Down)
	 * @param {String} action Required. Action in it's human readable format (Volume down)
	 * @private
	 */
	_prepareShortcutRow( tr, dataKey, dataAction, keys, action )
	{
		tr.dataset.keys   = dataKey;
		tr.dataset.action = dataAction;
		tr.classList.add( 'va' );
		tr.innerHTML = `<td>${keys}</td><td class="${dataAction}">${action}</td><td><button onclick="n.onDeleteKeyboardShortcut(this)">&times;</button></td>`;
	},

	/**
	 * Select items depending on the keys pressed. Here is the whole logic for multiple selection. Not local because
	 * it's used for both playlist and cloud items
	 * @param {Event} e Required. Mouse event happened
	 * @param {String} containerId Required. Container in which to search for items
	 * @param {String} itemClass Required. Class name of the items available for selection
	 * @param {String} selectedClass Required. Class name to be applied to the selected items
	 * @private
	 */
	_selectItems( e, containerId, itemClass, selectedClass )
	{
		let selectionStart = document.getElementById( 'selection-start' );

		if ( e.shiftKey )
		{
			if ( selectionStart )
			{
				// Get all items in the active playlist
				let items         = document.getElementById( containerId ).querySelectorAll( itemClass );
				// Get the index of the focused item
				let idx           = Array.prototype.indexOf.call( items, selectionStart );
				// Get the index of the clicked item
				let idx2          = Array.prototype.indexOf.call( items, this );
				let selectedItems = document.getElementById( containerId ).querySelectorAll( '.selected' );

				// First de-select all items
				for ( let i = 0; i < selectedItems.length; i++ )
				{
					selectedItems[ i ].classList.remove( 'selected' );
				}

				// Search for the selected and focused items inside of the find window if not found in the playlist
				if ( !~idx || !~idx2 )
				{
					let window = document.getElementById( 'find-window-results' );

					if ( window )
					{
						items = window.querySelectorAll( itemClass );
						// Get the index of the focused item
						idx   = Array.prototype.indexOf.call( items, selectionStart );
						// Get the index of the clicked item
						idx2  = Array.prototype.indexOf.call( items, this );
					}
				}

				// Continue only if both selected and focused items found
				if ( ~idx && ~idx2 )
				{
					// Get the lower index of both items
					let min = Math.min( idx, idx2 );
					// Get the higher index of both items
					let max = Math.max( idx, idx2 );

					// Iterate items between focused and clicked and toggle selected state
					for ( let i = min; i <= max; i++ )
					{
						let item = items[ i ];
						item.classList.add( selectedClass );
					}

					// Fix focused item, as it's selected class will always be removed
					items[ idx <= idx2 ? min : max ].classList.add( selectedClass );
				}
				// Otherwise user has clicked for the first time and we need to add class only to clicked element
				else
				{
					this.classList.add( selectedClass );
					this.id = 'selection-start';
				}
			}
		}
		else
		{
			if ( selectionStart )
			{
				selectionStart.removeAttribute( 'id' );
			}
			this.id = 'selection-start';

			if ( e.ctrlKey )
			{
				this.classList.toggle( selectedClass );
			}
			else
			{
				this.classList.add( selectedClass );
			}
		}
	},

	/**
	 * Evaluate regular string as if it was a template literal
	 * @param {String} string String to be evaluated
	 * @returns {String}
	 */
	literalize( string )
	{
		return eval( '`' + string + '`' );
	},

	_translate()
	{
		// Re-create HTML for the whats new screen
		n.initWhatsNew();

		document.documentElement.lang = n.pref.lang;

		let splashItems = n.lang.splash;

		Object.keys( splashItems ).forEach( key =>
		{
			// When changing language the splash screen isn't present in the DOM, so we need fake object to set the
			// HTML to
			let splashNode       = document.getElementById( key ) || {};
			splashNode.innerHTML = splashItems[ key ];
		} );

		let menuItems = n.lang.menu;
		Object.keys( menuItems ).forEach( key =>
		{
			document.getElementById( key ).innerHTML = menuItems[ key ];
		} );

		let windowItems = n.lang.window;
		Object.keys( windowItems ).forEach( key =>
		{
			document.getElementById( key ).innerHTML = n.literalize( windowItems[ key ] );
		} );

		let placeholderItems = n.lang.placeholders;
		Object.keys( placeholderItems ).forEach( key =>
		{
			document.getElementById( key ).placeholder = placeholderItems[ key ];
		} );

		let preferenceItems = n.lang.preferences;
		let id              = 'preferences-tabs';
		Object.keys( preferenceItems ).forEach( key =>
		{
			document.getElementById( id ).querySelector( `button[data-preference="${key}"]` ).innerHTML = preferenceItems[ key ];
		} );

		let actionItems = n.lang.actions;
		let secondId    = 'keyboard-shortcuts';
		const dotString = '.';

		id = 'actions';

		Object.keys( actionItems ).forEach( key =>
		{
			document.getElementById( id ).querySelector( `option[value="${key}"]` ).innerHTML = actionItems[ key ];

			let elements = document.getElementById( secondId ).querySelectorAll( dotString + key );

			for ( let i = 0; i < elements.length; i++ )
			{
				elements[ i ].innerHTML = n.lang.actions[ key ];
			}
		} );

		let themeItems = n.lang.themes;
		id             = 'preference-theme';
		Object.keys( themeItems ).forEach( key =>
		{
			document.getElementById( id ).querySelector( `option[value="${key}"]` ).innerHTML = themeItems[ key ];
		} );

		let buttonItems = n.lang.buttons;
		Object.keys( buttonItems ).forEach( key =>
		{
			let items = document.querySelectorAll( `.${key}` );

			for ( let i = 0; i < items.length; i++ )
			{
				items[ i ].innerHTML = buttonItems[ key ];
			}
		} );

		let validationItems = n.lang.validation;
		Object.keys( validationItems ).forEach( key =>
		{
			let items = document.querySelectorAll( `.${key}` );

			for ( let i = 0; i < items.length; i++ )
			{
				items[ i ].innerHTML = validationItems[ key ];
			}
		} );

		let consoleItems = n.lang.console;
		Object.keys( consoleItems ).forEach( key =>
		{
			let items = document.querySelectorAll( `.${key}` );

			for ( let i = 0; i < items.length; i++ )
			{
				items[ i ].innerHTML = consoleItems[ key ];
			}
		} );

		let footerItems = n.lang.footer;
		Object.keys( footerItems ).forEach( key =>
		{
			let item = document.getElementById( key ) || {};

			item.innerHTML = footerItems[ key ];
		} );

		let helpItems = n.lang.help;
		Object.keys( helpItems ).forEach( key =>
		{
			document.getElementById( key ).title = helpItems[ key ];
		} );

		let faq = n.lang.faq;

		// Translate FAQ window
		document.getElementById( 'faq-content' ).innerHTML = Object.keys( faq ).map( question => `<details><summary>${question}</summary><p>${faq[ question ]}</p></details>` ).join( '' );

		let notConnecteds = document.getElementById( 'add-window-cloud-chooser' ).querySelectorAll( '[data-cloud]:not([data-cloud*="local"])' );
		for ( let i = 0; i < notConnecteds.length; i++ )
		{
			notConnecteds[ i ].title = n.lang.other[ 'not-connected' ];
		}

		// Refresh window title
		n.setTitle( null, true );
		n.refreshWindowTitle();
	},

	/**
	 * Returns item being played/paused/loaded
	 * @returns {HTMLElement}
	 */
	get activeItem()
	{
		let item = document.getElementById( 'playlists' ).querySelector( 'div[data-icon="c"]' ) ||
			document.getElementById( 'playlists' ).querySelector( 'div[data-icon="x"]' ) ||
			document.getElementById( 'playlists' ).querySelector( 'div[data-icon="w"]' );

		return item && item.closest( '.playlist-item' );
	},

	/**
	 * Get the id of the currently visible to the user playlist.
	 *
	 * @return {String} Id
	 */
	get activePlaylistId()
	{
		let tab = document.getElementById( 'playlists-tabs' ).querySelector( '.active' );
		return tab ? tab.dataset.for : null;
	},

	/**
	 * Get currently selected language
	 * @returns {Object}
	 */
	get lang()
	{
		return n.langs[ n.pref.lang ];
	},

	/**
	 * Adds a file to a playlist
	 * @param {HTMLElement} file Required. Item from which to read all the cloud date
	 * @param {String} playlistId Required. Id of the playlist to which to add the new item
	 */
	addFile( file, playlistId )
	{
		n.fillPlaylist( playlistId, [
			{ url: file.dataset.path, cloud: file.dataset.cloud, placeholder: file.dataset.name }
		] );
	},

	/**
	 * Handler for Add button in cloud window. Adds selected files or folders to the active playlist
	 */
	addFileFolder()
	{
		// Get selected items
		let items      = document.getElementById( 'add-window-files' ).querySelectorAll( '.active' );
		let playlistId = n.activePlaylistId;

		// Make sure we are starting to add files without raised stop flag
		n.cancelAction = false;

		// Show stop icon in the footer
		document.getElementById( 'cancel-action' ).hidden = false;

		// Create a new playlist, if the user hasn't created/selected any
		if ( !playlistId )
		{
			n.newPlaylist();
			playlistId = n.activePlaylistId;
		}

		// Loop all selected items in asyncronius loop because of all AJAX requests
		asyncLoop( items.length - 1, loop =>
		{
			// Stop if the stop flag is up
			if ( n.cancelAction )
			{
				n.cancelAction = false;
				loop.break();
			}
			else
			{
				// Get current selected item
				let selected = items[ loop.index ];

				// Process as folder if one
				if ( selected.dataset.folder === 'true' )
				{
					// Setup counter of how many files are added. As this is an object, passing it as a param will
					// actually pass a reference, meaning all modifications to it will be available in the Promise then
					let count = {
						added: 0
					};

					// Start the recursive looping through the folder tree
					n.addFolder( selected.dataset.path, selected.dataset.cloud, count, playlistId ).then( _ =>
					{
						// Print success message in the status bar containing number of items added
						//todo: This doesn't seems to be dynamically translatable - if user switches language it won't
						// be translated properly
						n.setFooter( `<span id="footer-finished">${n.lang.footer[ 'footer-finished' ]} ${count.added}</span>` );

						// Save playlist as new items are added
						n.savePlaylist( document.getElementById( n.activePlaylistId ) );

						// Continue to next item in the selection
						loop.next();
					} );
				}
				// Otherwise just add the selected file and move on
				else
				{
					n.addFile( selected, playlistId );
					loop.next();
				}
			}
		} ).then( _ =>
		{
			// After everything is finished save the playlist
			n.savePlaylist( document.getElementById( n.activePlaylistId ) );

			// Take the stopping flag down
			n.cancelAction = false;

			// And finally remove the stop icon
			document.getElementById( 'cancel-action' ).hidden = true;
		} );

		// Close the window (user can monitor the process in the status bar)
		n.closeAll();
	},

	/**
	 * Recursive function for adding files from folder and subfolders
	 * @param {String} folder Required. Folder path/id being scanned
	 * @param {String} cloud Required. Cloud name from which we currently read items
	 * @param {Object} count Required. Object instance created at the beginning of the file/folder add process
	 * @param {String} playlistId Required. The id of the playlist to which the files should be added
	 */
	//TODO: Check if cloud is Google Drive and print different message to the status bar, as the id of the folder
	// doesn't bring any valuable information to him
	//TODO: Maybe make the count object not required
	addFolder( folder, cloud, count, playlistId )
	{
		// Show the new folder to the user
		//todo: Join adding-files-from and added-items into 1 template literal
		n.setFooter( `<span id="footer-progress">${n.lang.footer[ 'adding-files-from' ]} ${folder} ${n.lang.footer[ 'added-items' ]} ${count.added}</span>` );

		// Request folder contents
		return n[ cloud ].getFolderContents( folder, true ).then( ( { files, folders } ) =>
		{
			let toAdd = [];

			// Increase counter with the count of the returned files
			count.added += files.length;

			// Add all files to the playlist
			files.forEach( file =>
			{
				toAdd.push( { url: file.path, placeholder: file.name, cloud: file.cloud } );
			} );

			n.fillPlaylist( playlistId, toAdd );

			// Repeat if we have folders
			if ( folders.length )
			{
				// Asyncronius loop as we are waiting for server response
				return new Promise( resolve => asyncLoop( folders.length - 1, loop =>
				{
					// Stop if flag raised
					if ( n.cancelAction )
					{
						loop.break();
					}
					// Otherwise call ourselfs again
					else
					{
						n.addFolder( folders[ loop.index ].path, cloud, count, playlistId ).then( loop.next );
					}
				} ).then( resolve ) );
			}

			return Promise.resolve();
		} );
	},

	/**
	 * Adds item to cloud window. It's either a file item or folder item
	 * @param {Object} item Required. Object containing item name, type and from what cloud it's comming
	 * @returns {HTMLElement}
	 */
	addItemToWindow( item )
	{
		// Create the section element which will be apended to the cloud window
		let sec = document.createElement( 'section' );

		sec.className = 'add-item';
		sec.setAttribute( 'tabindex', 0 );

		// Make all key:value pairs of the passed item to be added to the section element as data-key="value"
		Object.assign( sec.dataset, item );

		// Add the visual to the user part (icon depending of the type and name)
		sec.innerHTML = `<span data-icon='${item.folder ? 'f' : '"'}'></span>${item.name}`;

		// Attach events to the newly created item
		sec.addEventListener( 'mousedown', n.onAddItemDown );
		sec.addEventListener( 'dblclick', n.onAddItemDblClick );

		// And append it
		document.getElementById( 'add-window-files' ).appendChild( sec );

		return sec;
	},

	/**
	 * Adds item to playback's queue.
	 * @param {HTMLElement|EventTarget} [item] Optional. Item to add to the queue. If not supplied, the selected one on
	 *     the active playlist will be added.
	 */
	addToQueue( item = n.currentlySelectedItem )
	{
		/**
		 * The real add to queue happens here. Because user may want to add more than one item, we need an external
		 * function for the adding part, so we can call it from different places
		 * @param {HTMLElement} item Required. Playlist item which we have to add to the queue
		 * @private
		 */
		function _add( item )
		{
			// Add item to the queue
			n.queue.push( item );

			// Set item queue state
			let queueState = item.querySelector( '.item-queue' );

			if ( !queueState.innerHTML )
			{
				queueState.innerHTML = n.queue.length;
			}
		}

		// Get all selected items
		let items = document.getElementById( n.activePlaylistId ).querySelectorAll( '.selected' );

		// Add them all if many
		if ( ~Array.prototype.indexOf.call( items, item ) )
		{
			for ( let i = 0; i < items.length; i++ )
			{
				_add( items[ i ] );
			}
		}
		// Or add only one if single
		else
		{
			_add( item );
		}
	},

	/**
	 * Enables or disables features, depending on the state of power save mode
	 */
	applyPowerSaveMode()
	{
		n.initAnimations();
		n.initBlur();
		n.changeCounterState( document.getElementById( 'preference-enable-counter' ).checked );
	},

	/**
	 * Constructs style tag for chosen theme and appends it to the DOM.
	 */
	applyTheme()
	{
		// Get selected theme
		let theme = document.getElementById( 'preference-theme' ).value;

		if ( n.themes[ theme ] )
		{
			document.getElementById( 'theme' ).innerHTML = n.themes[ theme ];

			return Promise.resolve();
		}
		else
		{
			return fetch( `/js/themes/${theme}.json?ver=${version}` ).then( response => response.json() ).then( json =>
			{
				// Style tag string to be appended in the end
				let styles = Object.keys( json ).map( selector =>
				{
					// Get the object of theme rules
					let selectorRules = json[ selector ];

					return `${selector}{${Object.keys( selectorRules ).map( selectedRule => `${selectedRule}:${selectorRules[ selectedRule ]};` ).join( '' )}}`;
				} ).join( '' );

				// Replace old styles with the new ones
				document.getElementById( 'theme' ).innerHTML = styles;

				// Cache the parsed theme if user wants to re-apply it
				n.themes[ theme ] = styles;

				return Promise.resolve();
			} );
		}
	},

	/**
	 * Changes state of the current window (enables/disables elements and empties others if needed). It contains an
	 * object will all posible windows and their states
	 * @param {String} state Required. State which should be applied to the active window. Value of 'default' is always
	 *     available if the windows has states
	 */
	applyWindowState( state )
	{
		let window  = document.querySelector( '.window' );
		let windows = {
			'add-window'             : {
				all()
				{
					let buttons = document.getElementById( 'add-window-buttons' ).querySelectorAll( 'button' );

					buttons[ 0 ].disabled = false;
					buttons[ 1 ].disabled = false;
				},
				file()
				{
					let buttons = document.getElementById( 'add-window-buttons' ).querySelectorAll( 'button' );

					buttons[ 0 ].disabled = false;
					buttons[ 1 ].disabled = true;
				},
				'default'()
				{
					let buttons = document.getElementById( 'add-window-buttons' ).querySelectorAll( 'button' );

					buttons[ 0 ].disabled = true;
					buttons[ 1 ].disabled = true;
				}
			},
			'save-playlist-window'   : {
				save()
				{
					let buttons = document.getElementById( 'save-playlist-window-buttons' ).children;

					buttons[ 0 ].disabled = false;
					buttons[ 1 ].disabled = false;
				},
				semi()
				{
					let buttons = document.getElementById( 'save-playlist-window-buttons' ).children;
					let val     = document.getElementById( 'save-playlist-window-filename' ).value.trim();

					if ( !val )
					{
						buttons[ 0 ].disabled = false;
						buttons[ 1 ].disabled = true;
					}
					else
					{
						buttons[ 0 ].disabled = false;
						buttons[ 1 ].disabled = false;
					}
				},
				'default'()
				{
					let buttons = document.getElementById( 'save-playlist-window-buttons' ).children;

					buttons[ 0 ].disabled = true;
					buttons[ 1 ].disabled = true;

					document.getElementById( 'save-playlist-window-filename' ).value = '';
				}
			},
			'load-playlist-window'   : {
				disabled()
				{
					document.getElementById( 'load-playlist-window-buttons' ).children[ 0 ].disabled = true;
				},
				file()
				{
					document.getElementById( 'load-playlist-window-buttons' ).children[ 0 ].disabled = false;
				},
				'default'()
				{
					document.getElementById( 'load-playlist-window-buttons' ).children[ 0 ].disabled = true;
				}
			},
			'save-preferences-window': {
				save()
				{
					let buttons = document.getElementById( 'save-preferences-window-buttons' ).children;

					buttons[ 0 ].disabled = false;
					buttons[ 1 ].disabled = false;
				},
				semi()
				{
					let buttons = document.getElementById( 'save-preferences-window-buttons' ).children;
					let val     = document.getElementById( 'save-preferences-window-filename' ).value.trim();

					if ( !val )
					{
						buttons[ 0 ].disabled = false;
						buttons[ 1 ].disabled = true;
					}
					else
					{
						buttons[ 0 ].disabled = false;
						buttons[ 1 ].disabled = false;
					}
				},
				'default'()
				{
					let buttons = document.getElementById( 'save-preferences-window-buttons' ).children;

					buttons[ 0 ].disabled = true;
					buttons[ 1 ].disabled = true;

					document.getElementById( 'save-preferences-window-filename' ).value = '';
				}
			},
			'load-preferences-window': {
				disabled()
				{
					document.getElementById( 'load-preferences-window-buttons' ).children[ 0 ].disabled = true;
				},
				file()
				{
					document.getElementById( 'load-preferences-window-buttons' ).children[ 0 ].disabled = false;
				},
				'default'()
				{
					document.getElementById( 'load-preferences-window-buttons' ).children[ 0 ].disabled = true;
				}
			}
		};

		if ( window && windows[ window.id ] && windows[ window.id ][ state ] )
		{
			windows[ window.id ][ state ]();
		}
	},

	/**
	 * Attaches event listeners to all items of all playlists and to the tabs
	 */
	attachEvents()
	{
		// Init drag and drop functionality for local files playback
		let filedrag = document.getElementById( 'drop-zone' );

		/**
		 * Handler for mouse over on a dropzone to style it differantly
		 * @param {Event} e
		 * @private
		 */
		function _fileDragHover( e )
		{
			e.stopPropagation();
			e.preventDefault();
			e.target.className = 'dragover' === e.type ? 'hover' : '';
		}

		// Attach all event listeners for drag and drop functionality
		filedrag.addEventListener( 'dragover', _fileDragHover, false );
		filedrag.addEventListener( 'dragleave', _fileDragHover, false );
		filedrag.addEventListener( 'drop', e =>
		{
			// Cancel event and hover styling
			_fileDragHover( e );

			n.onFilesSupplied( e );
		}, false );

		// Ask for permissions if the user has checked that he wants notifications
		document.getElementById( 'preference-enable-notifications' ).addEventListener( 'change', e => n.notify( null, e.currentTarget.checked ) );

		// Save on playback order change
		document.getElementById( 'playback-order' ).addEventListener( 'change', e =>
		{
			const target = e.currentTarget;

			n.audio.loop         = !(2 - target.selectedIndex);
			n.pref.playbackOrder = target.selectedIndex;
		} );

		// Attach event listeners to the tabs
		let tabs             = document.querySelectorAll( '.playlists-tabs-li' );
		let inputs           = document.querySelectorAll( 'input' );
		let icons            = document.querySelectorAll( '.cloud-icon' );
		let checkboxes       = document.querySelectorAll( '#preference-cursor-follows-playback,#preference-playback-follows-cursor' );
		const clickEvent     = 'click';
		const mouseDownEvent = 'mousedown';
		const keyDownEvent   = 'keydown';
		const changeEvent    = 'change';

		for ( let i = 0; i < tabs.length; i++ )
		{
			tabs[ i ].addEventListener( clickEvent, n.onTabClick );
			tabs[ i ].addEventListener( mouseDownEvent, n.onTabDown );
		}

		// Attach event handlers to the events for changing the checkboxes for playback order in the preferences
		for ( let i = 0; i < checkboxes.length; i++ )
		{
			checkboxes[ i ].addEventListener( changeEvent, n.onCursorCheckboxChange );
		}

		// Stop bubbling to all input fields as keyboard shortcuts may prevent user from typing in them
		for ( let i = 0; i < inputs.length; i++ )
		{
			inputs[ i ].addEventListener( keyDownEvent, n.stopBubbling );
		}

		// Set data-keys property for the input in which the user adds new keyboard shortcuts
		document.getElementById( 'keyboard-shortcut' ).addEventListener( keyDownEvent, e =>
		{
			const target = e.currentTarget;
			const keys   = n.getKeys( e );

			target.value = keys.keys.join( ' + ' );

			target.dataset.keys = keys.keyProperty.join( '+' );

			e.preventDefault();
		} );

		// Adds new keyboard shortcut to the table
		document.getElementById( 'shortcut-add' ).addEventListener( 'click', _ =>
		{
			// Continue only if keyboard shortcut entered
			let input = document.getElementById( 'keyboard-shortcut' );

			if ( !input.value )
			{
				return;
			}

			// Get key combination from the input
			let keys = input.dataset.keys;

			// Alert the user if the shortcut already exists
			if ( document.getElementById( 'keyboard-shortcuts' ).querySelector( `tr[data-keys="${keys}"]` ) )
			{
				n.window( 'exists' );
			}
			// Otherwise add it to the table
			else
			{
				let insertBefore = document.getElementById( 'actions' );
				let tr           = document.createElement( 'tr' );
				let select       = document.getElementById( 'actions' );
				let tagName      = 'tr';

				// Find the position in which the row will be added
				while ( tagName !== insertBefore.tagName.toLowerCase() )
				{
					insertBefore = insertBefore.parentNode;
				}

				// Fill the row with needed atributes and HTML
				n._prepareShortcutRow(
					tr,
					keys,
					select.value,
					input.value,
					document.getElementById( 'actions' ).querySelector( `option[value="${select.value}"]` ).innerHTML
				);

				insertBefore.parentNode.insertBefore( tr, insertBefore );

				// Save preferences as new information is added
				n.pref.key = { action: select.value, key: input.getAttribute( 'data-keys' ) };
			}
		} );

		// Save preferences when user changes an input inside the preferences window
		inputs = document.getElementById( 'preferences-container' ).querySelectorAll( 'input:not(#keyboard-shortcut)' );

		let _onChange = event => n.pref.input = event.currentTarget;

		for ( let i = 0; i < inputs.length; i++ )
		{
			inputs[ i ].onchange = _onChange;
		}

		// Make Find window work
		document.getElementById( 'find-item' ).addEventListener( keyDownEvent, n.find );

		// Make X button on windows work
		document.getElementById( 'window-close' ).addEventListener( clickEvent, n.closeAll );

		/* Start: Window state events */

		// Change window state when save playlist name entered
		document.getElementById( 'save-playlist-window-filename' ).addEventListener( 'input', n.onSaveNameInput );

		// Change window state when save preferences name entered
		document.getElementById( 'save-preferences-window-filename' ).addEventListener( 'input', n.onSaveNameInput );

		/* End: Window state events */

		// Reset styles of cloud choosing icons in add/save window and select service depending on what the user clicked
		let _onIconClick = e =>
		{
			const cloudName = e.currentTarget.dataset.cloud;
			const cloud     = n[ cloudName ];

			if ( cloud.isAuthenticated )
			{
				document.getElementById( 'loading-folder-contents' ).classList.remove( 'visibility-hidden' );
				n.selectService( cloudName );
			}
			else
			{
				cloud.connect();
			}
		};

		for ( let i = 0; i < icons.length; i++ )
		{
			icons[ i ].addEventListener( clickEvent, _onIconClick );
		}

		// Listen for key presses on playlists to control the selected item/playlist
		let _onPlaylistDown = e =>
		{
			const keyCode = e.keyCode;
			const keys    = n.getKeys( e );
			const item    = document.getElementById( 'keyboard-shortcuts' ).querySelector( `tr[data-keys="${keys.keyProperty.join( '+' )}"]` );

			// Check if we have key combination with Down happening and do nothing if we have
			if ( !item )
			{
				// Left and Right
				if ( keyCode === 37 || keyCode === 39 )
				{
					let toSelect;

					// Get all tabs
					const tabs = document.getElementById( 'playlists-tabs' ).querySelectorAll( 'div[data-for]' );

					// Get selected tab
					let tab = document.querySelector( `div[data-for="${n.activePlaylistId}"]` );

					const idx = Array.prototype.indexOf.call( tabs, tab );

					if ( tab )
					{
						// Get previous or next tab
						toSelect = tabs[ idx + (keyCode === 37 ? -1 : 1) ];

						// Get last/first tab if no previous/next (we've reached the beginning/end)
						if ( !toSelect )
						{
							toSelect = tabs[ keyCode === 37 ? tabs.length - 1 : 0 ];
						}
					}
					// If we have one
					else
					{
						toSelect = tabs[ 0 ];
					}

					// If there are not tabs created, we won't have anything to select
					if ( toSelect )
					{
						// Select it
						n.changePlaylist( toSelect );

						// Focus is needed so next time our keydown is working
						document.getElementById( 'playlists-wrapper' ).focus();
					}

					e.preventDefault();
				}
				// Up and Down
				else if ( keyCode === 38 || keyCode === 40 )
				{
					// Get previous playlist item
					let toSelect = n.currentlySelectedItem[ `${keyCode === 38 ? 'previous' : 'next'}ElementSibling` ];

					// Get last playlist item if no previous (we've reached the beginning)
					if ( !toSelect )
					{
						toSelect = document.getElementById( n.activePlaylistId )[ `${keyCode === 38 ? 'last' : 'first'}ElementChild` ];
					}

					// Deselect items
					n._deselectItems();

					// Select chosen item
					n._selectItems.call( toSelect, {}, n.activePlaylistId, '.playlist-item', 'selected' );

					// Scroll the item into the view
					scrollIntoViewIfOutOfView( toSelect );

					e.preventDefault();
				}
			}
		};

		document.getElementById( 'playlists-wrapper' ).addEventListener( 'keydown', _onPlaylistDown );

		// We need to remember user's choice for showing or not the whats new screen
		document.getElementById( 'show-on-startup-checkbox' ).addEventListener( changeEvent, e => n.pref.showWhatsNew = e.currentTarget.checked );

		// We need to make animation setting work immediately
		document.getElementById( 'preference-enable-animations' ).addEventListener( changeEvent, n.initAnimations );

		// We need to enable/diable range input and buttons depending on the state of the checkbox
		document.getElementById( 'preference-enable-scrobbling' ).addEventListener( changeEvent, e => n.changeScrobblingState( e.currentTarget.checked ) );

		// We need to enable/diable threshold dropdown depending on the state of the checkbox
		document.getElementById( 'preference-enable-powersaver' ).addEventListener( changeEvent, e => n.changePowerSaverState( e.currentTarget.checked ) );

		// We need to enable/diable range input and buttons depending on the state of the checkbox
		document.getElementById( 'preference-enable-counter' ).addEventListener( changeEvent, e => n.changeCounterState( e.currentTarget.checked ) );

		const alternateButtons = document.querySelectorAll( '[data-alternate-action]' );

		for ( let i = 0; i < alternateButtons.length; i++ )
		{
			alternateButtons[ i ].addEventListener( 'mousedown', e =>
			{
				const target = e.currentTarget;

				clearTimeout( n.actionTimeout );
				n.actionTimeout = setTimeout( _ => n.toggleAlternate( target, true ), 1000 );

				// Make sure even if user releases mouse button while cursor is away from the Play button, to fix button
				// state
				document.body.addEventListener( 'mouseup', e =>
				{
					clearTimeout( n.actionTimeout );

					// If user released the mouse while not on the button we need to switch back to the previous action
					if ( target !== e.target )
					{
						n.toggleAlternate( target );
					}
				}, { once: true } );
			} );
		}
	},

	/**
	 * Stops renaming of all playlists and return old name
	 */
	stopRenames()
	{
		const title = document.querySelector( '[contenteditable="true"]' );

		title.removeAttribute( 'contenteditable' );
		title.removeEventListener( 'keydown', n.onRenameKeyDown );
	},

	changeCounterState( state )
	{
		const counter = document.getElementById( 'footer-counter' );

		counter.innerHTML = '';

		counter.hidden = !state || n.powerSaveMode;
	},

	/**
	 * Translates interface and saves the change.
	 */
	changeLanguage( language )
	{
		n.pref.lang = language;
		n.translate();
	},

	/**
	 * Switches active playlist to the one associated with the tab passed.
	 * @param {HTMLElement} tab Required. Tab to activate and read information about which playlist should be shown.
	 */
	changePlaylist( tab )
	{
		// Remove active tab class and hide the playlist associated with it
		let el = document.getElementById( 'playlists-tabs' ).querySelector( '.playlists-tabs-li.active' );

		if ( el )
		{
			document.getElementById( el.dataset.for ).hidden = true;
			el.classList.remove( 'active' );
		}

		// Set clicked tab as active
		tab.classList.add( 'active' );

		// Show playlist for the clicked tab
		document.getElementById( tab.dataset.for ).hidden = false;

		n.saveActivePlaylistIdDelayed();
	},

	/**
	 * Method to enable or disable threshold dropdown when user checks/un-checks Enable Power saver option
	 * @param {Boolean} enabled Required. State to which we should set the dropdown
	 */
	changePowerSaverState( enabled )
	{
		document.getElementById( 'power-saver-state' ).disabled = !enabled;

		// We need to change power save mode also
		if ( enabled && n.battery )
		{
			n.updateBatteryStatus();
		}
		else
		{
			n.powerSaveMode = false;
			n.applyPowerSaveMode();

			if ( n.battery )
			{
				n.updateBatteryStatus();
			}
		}
	},

	/**
	 * Method to enable or disable range input and buttons when user checks/un-checks Enable scrobbling option
	 * @param {Boolean} enabled Required. State to which we should set the range
	 */
	changeScrobblingState( enabled )
	{
		document.getElementById( 'lastfm-preferences' ).disabled = !enabled;
	},

	/**
	 * Changes interface to the chosen theme and saves the preferences.
	 */
	changeStyle( theme )
	{
		n.applyTheme();
		n.pref.theme = theme;
	},

	/**
	 * Check for token in the URL and if the user is connected to a cloud service
	 */
	checkConnections()
	{
		const toCheck = [
			'dropbox',
			'googledrive',
			'lastfm'
		];

		const _checkConnection = ( cloudName, resolve ) =>
		{
			const cloud = n[ cloudName ];

			if ( cloud.isAuthenticated )
			{
				// Some tokens expire so we need to check if they are still valid, as isAuthenticated shows only if we
				// have token
				//TODO: Maybe integrate checkToken method call inside isAuthenticated getter and return
				// true only if token is good
				cloud.checkToken().then( _ =>
				{
					let as = ` <span class="as">${n.lang.console.as}</span>${cloud.display_name}`;

					n.log( 'connected', `${cloud.name}${as}` );

					document.getElementById( `connected-${cloud.codeName}` ).innerHTML = as;

					const icon = document.getElementById( 'add-window-cloud-chooser' ).querySelector( `[data-cloud="${cloud.codeName}"]` );

					// last.fm doesn't have icon in Add window
					if ( icon )
					{
						icon.removeAttribute( 'title' );
					}

					resolve();
				} ).catch( _ =>
				{
					document.getElementById( `connected-${cloud.codeName}` ).innerHTML = n.lang.console.no;

					delete n[ cloud.codeName ].accessToken;

					n.pref.accessToken = {
						cloud      : cloud.codeName,
						accessToken: null
					};

					const icon = document.getElementById( 'add-window-cloud-chooser' ).querySelector( `[data-cloud="${cloud.codeName}"]` );

					// last.fm doesn't have icon in Add window
					if ( icon )
					{
						icon.title = n.lang.other[ 'not-connected' ];
					}

					resolve();
				} );
			}
			// If isAuthenticated is false, we could be dealing with a Promise and we need to wait for it to finish.
			else if ( cloud.accessToken && cloud.accessToken.constructor === Promise )
			{
				cloud.accessToken.then( _ => _checkConnection( cloudName, resolve ) ).catch( _ => _checkConnection( cloudName, resolve ) );
			}
			else
			{
				// Visually disable the icon in file chooser for that cloud
				let icon = document.getElementById( 'add-window-cloud-chooser' ).querySelector( `[data-cloud="${cloudName}"]` );

				if ( icon )
				{
					icon.title = n.lang.other[ 'not-connected' ];
				}
				// Special case for Last.fm - we don't have an icon to disable, but we do have a checkbox in the
				// preferences that needs disabling
				else if ( 'lastfm' === cloudName )
				{
					let checkbox     = document.getElementById( 'preference-enable-scrobbling' );
					checkbox.checked = false;
					n.changeScrobblingState( false );
					checkbox.disabled = true;
				}

				document.getElementById( `connected-${cloudName}` ).innerHTML = n.lang.console.no;

				resolve();
			}
		};

		const { hash, search } = location;
		let split              = [];

		if ( hash && '#' !== hash )
		{
			split = hash.split( '#' ).pop().split( '&' );
		}
		else if ( search && '?' !== search )
		{
			split = search.split( '?' ).pop().split( '&' );
		}

		split.some( part =>
		{
			// Dropbox and Google Drive are returning directly the access token
			if ( part.startsWith( 'access_token=' ) )
			{
				let accessToken = part.split( '=' ).pop();

				n[ n.pref.tokenCloud ].accessToken = accessToken;

				n.pref.accessToken = { cloud: n.pref.tokenCloud, accessToken };

				return true;
			}
			// Last.fm returns the token as "token" param and requires a special session token to be generated
			else if ( part.startsWith( 'token=' ) )
			{
				const token       = part.split( '=' ).pop();
				const accessToken = n[ n.pref.tokenCloud ].getAccessToken( token ).then( response =>
				{
					n[ n.pref.tokenCloud ].userName    = response.session.name;
					n[ n.pref.tokenCloud ].accessToken = response.session.key;

					n.pref.userName    = {
						cloud   : n.pref.tokenCloud,
						userName: response.session.name
					};
					n.pref.accessToken = {
						cloud      : n.pref.tokenCloud,
						accessToken: response.session.key
					};
				} ).catch( _ => n.error( 'error-getting-access-token', n[ n.pref.tokenCloud ].name ) );

				n[ n.pref.tokenCloud ].accessToken = accessToken;

				n.pref.accessToken = {
					cloud: n.pref.tokenCloud,
					accessToken
				};

				//todo: This code is specific to last.fm, while this else-if could be used by other clouds with same
				// URL structure. For not that is not the case and it's unknown if it ever will be, but it's a good
				// practice to move this code out of here, to a better place.
				// Automatically enable last.fm scrobbling when user authenticates.
				n.changeScrobblingState( true );

				return true;
			}

			return false;
		} );

		// Make sure our URL is clean
		history.replaceState( {}, '', '/' );

		return new Promise( resolve => Promise.all( toCheck.map( cloudName => new Promise( resolve => _checkConnection( cloudName, resolve ) ) ) ).then( resolve ) );
	},

	/**
	 * Checks the size taken by Noisy in localStorage and issues warnings/errors if user is close or at the end of the
	 * quota
	 */
	checkQuota()
	{
		let length      = 0;
		let preferences = localStorage.getItem( 'preferences' );
		let playlists   = localStorage.getItem( 'playlists' );

		// Add preferences JSON to the length
		if ( preferences )
		{
			length += preferences.length;
		}

		// Add playlists JSON to the length
		if ( playlists )
		{
			length += playlists.length;
		}

		if ( 5200000 < length )
		{
			n.error( 'quota-limit-reached' );
		}
		else if ( 4194304 <= length )
		{
			n.warn( 'quota-limit-nearing', `${((length / 1024) / 1024).toFixed( 2 )} MB` );
		}
		else
		{
			n.log( 'quota-used', `${((length / 1024) / 1024).toFixed( 2 )} MB` );
		}
	},

	/**
	 * Clears the console.
	 */
	clearConsole()
	{
		n.console.innerHTML = '';
	},

	/**
	 * Empties inputs in the window and resets selects to 0
	 */
	clearWindow()
	{
		let inputs        = document.querySelectorAll( '#keyboard-shortcut,#save-playlist-window-filename,#save-preferences-window-filename' );
		let data          = document.querySelector( '.window' ).dataset;
		let selects       = document.querySelectorAll( '#connect-to,#add-files-service-choose,#actions' );
		const emptyString = '';

		for ( let i = 0; i < inputs.length; i++ )
		{
			inputs[ i ].value = emptyString;
		}

		Object.keys( data ).forEach( key =>
		{
			delete data[ key ];
		} );

		for ( let i = 0; i < selects.length; i++ )
		{
			selects[ i ].selectedIndex = 0;
		}
	},

	/**
	 * Close all kind of windows, playlist renaming, etc.
	 */
	closeAll()
	{
		n.closeWindow();
	},

	/**
	 * Refreshes playlists/statusbar/window title if it need to.
	 */
	closePreferences()
	{
		if ( n.shouldRefreshPlaylist )
		{
			n.refreshPlaylists();
		}

		if ( n.shouldRefreshStatusBar )
		{
			n.refreshStatusbar();
		}

		if ( n.shouldRefreshWindowTitle )
		{
			n.refreshWindowTitle();
		}

		let confirmation = document.getElementById( 'preferences-window-buttons' ).querySelectorAll( '.confirmation' );

		if ( confirmation.length )
		{
			confirmation[ 0 ].classList.remove( 'confirmation' );
		}
	},

	/**
	 * Close opened window and execute closePreferences if opened window is Preferences window.
	 */
	closeWindow()
	{
		let window = document.querySelector( '.window' );
		let id     = window.id;

		if ( id )
		{
			n.applyWindowState( 'default' );

			// Apply settings if any
			if ( 'preferences-window' === id )
			{
				n.closePreferences();
			}

			// Timeout is needed for the CSS transition to finish before hiding the window
			setTimeout( _ => window.removeAttribute( 'id' ), 300 );

			// Remove other classes from the window
			//todo: Do we actually change this class somewhere? .exists???
			window.className = 'window';

			n.clearWindow();
		}

		// Remove blur
		window.parentNode.classList.remove( 'window-opened' );
	},

	/**
	 * Connects to a cloud service.
	 */
	connect()
	{
		n.window( 'connect-window' );
	},

	/**
	 * Calls connect method for the chosen cloud service.
	 */
	connectTo()
	{
		n[ document.getElementById( 'connect-to' ).value ].connect();
	},

	/**
	 * Creates tab and playlist elements in the DOM and selects the newly
	 * created playlist
	 *
	 * @param {String} name Required. Name of the playlist.
	 * @param {String} id Required. Playlist id. Format: playlist-{unix_time}
	 * @param {Boolean} [save] Optional. Should the playlist be saved after it's creation.
	 */
	createPlaylist( name, id, save )
	{
		// Remove unwanted empty characters in the beginning and at the end of the name
		name = name.trim();

		// Create the tab
		const tab = document.createElement( 'div' );

		tab.dataset.for  = id;
		tab.dataset.name = name;
		tab.className    = 'playlists-tabs-li flex';
		tab.tabIndex     = 0;
		tab.innerHTML    = `<div class="playlist-name">${name}</div> <div class="playlist-edit"><span data-icon="!"></span></div> <div class="playlist-remove">&times;</div>`;

		tab.querySelector( '.playlist-name' ).addEventListener( 'dblclick', n.renamePlaylist );
		tab.querySelector( '.playlist-edit' ).addEventListener( 'click', n.renamePlaylist );
		tab.querySelector( '.playlist-remove' ).addEventListener( 'click', n.deletePlaylist );

		document.getElementById( 'playlists-tabs' ).insertBefore( tab, document.getElementById( 'add-playlist' ) );

		tab.addEventListener( 'click', n.onTabClick );
		tab.addEventListener( 'mousedown', n.onTabDown );

		// Create the playlist
		const playlist = document.createElement( 'article' );

		playlist.hidden       = true;
		playlist.id           = id;
		playlist.dataset.name = name;
		playlist.className    = 'playlist scroll-y';
		playlist.setAttribute( 'onscroll', 'n.saveActivePlaylistIdDelayed()' );

		document.getElementById( 'playlists' ).appendChild( playlist );

		// Save the playlist if needed
		if ( save )
		{
			n.savePlaylists();
		}

		// Remove tab view if only one tab
		n.oneTabCheck();

		return tab;
	},

	/**
	 * Returns first item from user's selection if available or the first item of the playlist.
	 * @returns {HTMLElement}
	 */
	get currentlySelectedItem()
	{
		return n.currentlySelectedItems[ 0 ] || document.getElementById( n.activePlaylistId ).children[ 0 ];
	},

	/**
	 * Returns a list of items selected by the user.
	 * @returns {NodeList}
	 */
	get currentlySelectedItems()
	{
		return document.getElementById( n.activePlaylistId ).querySelectorAll( '.selected' );
	},

	/**
	 * Deletes the selected item from the active playlist.
	 */
	deleteItems( item )
	{
		let toDelete = item ? [ item ] : n.currentlySelectedItems;
		let len      = toDelete.length;

		// Delete only if selected item(s) found
		for ( let i = 0; i < len; i++ )
		{
			let selected = toDelete[ i ];
			selected.remove();
		}

		// Save playlist if selected items(s) found
		if ( len )
		{
			n.savePlaylist( document.getElementById( n.activePlaylistId ) );
		}
	},

	/**
	 * Deletes playlist.
	 */
	deletePlaylist( e )
	{
		const tab        = e.currentTarget.closest( '[data-for]' );
		const toActivate = tab.previousElementSibling || tab.nextElementSibling;

		// If we have closed last tab and we don't have next tab to activate, we need to show to the user the hints
		// screen
		if ( toActivate.id === 'add-playlist' )
		{
			n.pref.activePlaylistId = null;
		}
		else
		{
			n.changePlaylist( toActivate );
		}

		// Remove tab
		tab.remove();

		// Remove playlist itself
		document.getElementById( tab.dataset.for ).remove();

		// Save change
		n.savePlaylists();

		// Remove tab view if only one tab
		n.oneTabCheck();
	},

	/**
	 * Detect what codecs are supported by the browser.
	 */
	detectFormats()
	{
		// Continue only if never detected this session
		if ( !n.formats.length )
		{
			// Possible codecs
			let types = [
				'audio/mpeg;',
				'audio/ogg; codecs="vorbis"',
				'audio/ogg; codecs="opus"',
				'audio/wav; codecs="1"',
				'audio/mp4; codecs="mp4a.40.2"'
			];

			types.forEach( type =>
			{
				// Add as supported if browser says it can be played
				if ( n.audio.canPlayType( type ).replace( /no/, '' ) )
				{
					n.formats.push( type.split( ';' )[ 0 ] );
				}
			} );
		}
	},

	/**
	 * Removes all files listed on the file dialog.
	 */
	emptyAddWindow()
	{
		// Remove cloud contents
		document.getElementById( 'add-window-files' ).innerHTML = '';
	},

	emptyFindWindow()
	{
		n.initSearch( document.getElementById( 'find-item' ).value = n.lastSearchTerm = '' );
	},

	/**
	 * Adds an error line to the console.
	 *
	 * @param {String} section Contains property name in the language object for the action we are logging.
	 * @param {String} [data] Text to be printed in the console.
	 */
	error( section, data = '' )
	{
		n.console.innerHTML += `<div class="nb-error"><span class="${section}">${n.lang.console[ section ]}</span>${data}</div>`;
		document.getElementById( 'color-bulb' ).classList.add( 'nb-error' );
	},

	/**
	 * Fills playlist with items and eventualy saves it
	 *
	 * @param {String} id Required. Id of the playlist to be filled.
	 * @param {Array} items Required. Array of objects with all items to be filled to the playlist.
	 * @param {Boolean} [save] Optional. Save the playlist if available and true.
	 */
	fillPlaylist( id, items, save )
	{
		// Will append all items to a document fragment first - much faster that way
		let df                = document.createDocumentFragment();
		const elementToCreate = 'section';
		const tabIndexString  = 'tabindex';
		const cloudString     = 'dropbox';
		const initialHTML     = '<div class="flex playback-options"><div class="flex-item-full"><div class="item-queue"></div><div class="item-add-to-queue" data-icon="Q"></div><div class="item-remove-from-queue" data-icon="P"></div></div><div class="playback-status"></div></div><div class="item-title flex-ellipsis"></div>';
		const dblClickEvent   = 'dblclick';
		const mouseDownEvent  = 'mousedown';

		items.forEach( itm =>
		{
			// DOM item itself
			let item = document.createElement( elementToCreate );

			// Add tab index as we need it to know which is the last selected item in
			//the calculations for multiple select with shiftkey
			item.setAttribute( tabIndexString, 0 );

			// This is only for now, as we do not support any other service than Dropbox
			itm.cloud = itm.cloud || cloudString;

			// Setting all available attributes to the DOM item
			Object.assign( item.dataset, itm );

			// Check if current item is supported by the browser
			let mimeType = itm.mimetype;

			if ( mimeType && !n.formats.includes( mimeType ) )
			{
				item.classList.add( 'can-not-play' );
			}

			// Add styling classes
			item.classList.add( 'playlist-item' );
			item.classList.add( 'flex' );

			// Format title as Artist - Title string if either of the two is available
			item.innerHTML = initialHTML;
			n.renderItem( item );

			item.addEventListener( dblClickEvent, n.onRowDblClick );
			item.addEventListener( mouseDownEvent, n.onRowDown );

			// Append the item to the fragment
			df.appendChild( item );
		} );

		// Append the fragment to the playlist
		document.getElementById( id ).appendChild( df );

		// Save if we have to
		if ( save )
		{
			n.savePlaylist( document.getElementById( id ) );
		}
	},

	/**
	 * Searches for items.
	 *
	 * @param {Event} e Required. Event for the input element in which
	 * the search term is entered. Searching is done only when Enter key is pressed.
	 */
	find( e )
	{
		const keyCode = e.keyCode;

		// Enter pressed
		if ( 13 === keyCode )
		{
			const val = e.currentTarget.value.toLowerCase().trim();

			// If user pressed Enter again, without changing the search term, we need to initiate play on the selected
			// item
			if ( n.lastSearchTerm === val )
			{
				n.play();
			}
			else
			{
				// Search for term
				n.initSearch( n.lastSearchTerm = val );

				// Select first result
				const item = document.getElementById( 'find-window-results' ).querySelector( '.playlist-item' );

				if ( item )
				{
					// Select first item in results window and in playlist
					n.onRowDown( { target: item, currentTarget: item } );
				}
			}
		}
		// Up or Down key pressed
		else if ( 38 === keyCode || 40 === keyCode )
		{
			let results = document.getElementById( 'find-window-results' ).querySelectorAll( '.playlist-item' );

			if ( results.length )
			{
				// Get selected item
				const selected = document.getElementById( 'find-window-results' ).querySelector( '.selected' );

				// Find it's index in the parent's children
				const idx = Array.prototype.indexOf.call( results, selected );

				let item;

				if ( 38 === keyCode )
				{
					// Check if we are the first item and select the last one if true
					if ( 0 > idx - 1 )
					{
						item = results[ results.length - 1 ];
					}
					else
					{
						item = results[ idx - 1 ];
					}
				}
				else
				{
					// Check if we are the last item and select the first one if true
					if ( results.length <= idx + 1 )
					{
						item = results[ 0 ];
					}
					else
					{
						item = results[ idx + 1 ];
					}
				}

				// Select first item in results window and in playlist
				n.onRowDown( { target: item, currentTarget: item } );
			}
		}
		// Esc key pressed
		else if ( 27 === keyCode )
		{
			n.closeAll();
		}
	},

	/**
	 * Formats string by replacing %property% with value of data-property.
	 *
	 * @param {String} string Required. String to be formated.
	 * @param {HTMLElement} item Required. Playlist item from which to read data properties.
	 *
	 * @return {String} Formated string.
	 */
	formatString( string, item )
	{
		// Find if artist, album, title and date are required in the supplied string
		let needed  = {
			artist: /%artist%/g.exec( string ),
			album : /%album%/g.exec( string ),
			title : /%title%/g.exec( string ),
			date  : /%date%/g.exec( string )
		};
		// Count how many of the of the tag we are not using
		let notUsed = 0;

		// Loop through tags to format them
		Object.keys( needed ).forEach( tag =>
		{
			let regEx = needed[ tag ];

			// Create regex for current tag if needed
			let replaceEx = regEx ? new RegExp( regEx[ 0 ], 'g' ) : '';

			// Replace the tag with the value if found
			if ( regEx && item.dataset[ tag ] )
			{
				string = string.replace( replaceEx, item.dataset[ tag ] );
			}
			// Otherwise if we have the regex, but not the value, replace the tag with an empty space and count it as
			// not used;
			else if ( regEx )
			{
				string = string.replace( replaceEx, '' );
				notUsed++;
			}
			// And finally if nothing worked, this means this tag is not used and not required, so only count as not
			// used;
			else
			{
				notUsed++;
			}
		} );

		// If all tags are counted as not used, then use the placeholder string as a result;
		if ( 4 === notUsed )
		{
			string = item.dataset.placeholder;
		}

		return string;
	},

	/**
	 * Gets all of the items in a playlist.
	 * @param {String} [playlist] Optional. Id of the playlist we want all items
	 * from. If not playlist supplied, currently active one will be used.
	 * @returns {NodeList} Items of the playlist.
	 */
	getAllItems( playlist = n.activePlaylistId )
	{
		return document.getElementById( n.activePlaylistId ).querySelectorAll( '.playlist-item' );
	},

	/**
	 * Get cloud name from passed item
	 *
	 * @param {HTMLElement} item Required. Playlist item from which to read the cloud name
	 *
	 * @return {String} Cloud service name
	 */
	getCloud( item )
	{
		return item.dataset.cloud;
	},

	/**
	 * Returns item based on the playlist passed.
	 *
	 * @param {String} [playlist] Optional. Id of the playlist from which the item will be picked.
	 * @param {Number} [idx] Optional. Index of the item to be returned. If
	 * not supplied the selected item will be returned.
	 *
	 * @return {HTMLElement} Playlist item.
	 */
	getItem( playlist, idx )
	{
		// Cannot continue if playlist is not supplied, so get the id of the active item
		return idx ? n.getAllItems( playlist ).item( idx ) : n.currentlySelectedItem;
	},

	/**
	 * Gets all the pressed keyboard keys.
	 *
	 * @param {Event} e Keyboard event from which keyCodes will be read.
	 *
	 * @return {Object} Object containing both keyCodes and names of the pressed keys.
	 */
	getKeys( e )
	{
		// Contains keyCode items
		let keyProperty    = [];
		// Contains human readable key names
		let keys           = [];
		const keyCode      = e.keyCode;
		const special      = { 16: e.shiftKey, 17: e.ctrlKey, 18: e.altKey, 91: e.metaKey };
		const specialCodes = Object.keys( special );

		// Add every special key pressed
		specialCodes.forEach( code => special[ code ] && keys.push( keyCodes[ code ] ) && keyProperty.push( code ) );

		// Add non-special key
		!specialCodes.includes( keyCode ) && keys.push( keyCodes[ keyCode ] ) && keyProperty.push( keyCode );

		return { keys, keyProperty };
	},

	/**
	 * Get the URL from an item.
	 * @param {HTMLElement} [item] Optional. Playlist item from which to read the URL.
	 * @return {String} URL to the file.
	 */
	//TODO: This method is not used. Do we need it?
	getURLFromItem( item = n.currentlySelectedItem )
	{
		return item ? item.dataset.url : null;
	},

	/**
	 * NB initialization function. Called on window load
	 */
	init()
	{
		// Load the preferences first, as we need to know which language and theme to load
		n.pref.process();

		// Before everything, if user is using the appspot domain, we should redirect him to https://www.noisyplayer.com
		if ( location.host.includes( 'appspot' ) )
		{
			location.replace( 'https://www.noisyplayer.com' );
		}

		return Promise.all( [
			n.translate(),
			n.applyTheme()
		] ).then( n.checkConnections ).then( _ =>
		{
			n.initBatteryWatcher().then( _ => n.applyPowerSaveMode() );

			n.initAudio();

			// Set the counter for lastfm
			n.updateScrobbleCounter();

			n.changeScrobblingState( n.pref.settings.checkboxes[ 'preference-enable-scrobbling' ] );

			const clickEvent     = 'click';
			const mouseDownEvent = 'mousedown';
			const keyDownEvent   = 'keydown';
			const dblClickEvent  = 'dblclick';

			// Load all available playlists
			n.loadAndRenderPlaylists();

			// Check how much space user took from the 5MB quota of localStorage
			n.checkQuota();

			// Resume where user left
			if ( n.pref.activePlaylistId )
			{
				let playlist = document.getElementById( n.pref.activePlaylistId );

				if ( playlist )
				{
					let scrollTop = n.pref.scrollTop;

					// Let the rendering engine catchup
					setTimeout( _ => playlist.scrollTop = scrollTop );

					n.changePlaylist( document.querySelector( `div[data-for="${n.pref.activePlaylistId}"]` ) );
				}
				else
				{
					n.warn( 'missing-element', n.pref.activePlaylistId );
				}
			}

			// Attach events to the DOM elements of the player
			n.attachEvents();

			// Attach menu events
			let menuItems    = document.querySelectorAll( '[data-menulistener]' );
			let prefTabs     = document.querySelectorAll( '.preferences-item' );
			let _onItemClick = function ( e )
			{
				// Stop bubbling otherwise the window (if any) opened will be immediately closed
				e.stopPropagation();

				// Execute needed method
				n[ this.dataset.menulistener ].call( this );
			};
			let _onTabClick  = function ()
			{
				// Check if user clicked on the active tab already and stop execution if true
				if ( this.classList.contains( 'active' ) )
				{
					return;
				}

				// Get all preference tabs contents
				let preferences = document.getElementById( 'preferences-container' ).children;
				let len         = preferences.length;

				// Remove active class from active tab
				document.getElementById( 'preferences-tabs' ).querySelector( '.active' ).classList.remove( 'active' );

				// Add active class to clicked tab
				this.classList.add( 'active' );

				// Hide all tab contents
				for ( let i = 0; i < len; i++ )
				{
					preferences[ i ].hidden = true;
				}

				// Show content for selected tab
				document.getElementById( `preference-${this.dataset.preference}` ).hidden = false;
			};

			for ( let i = 0; i < menuItems.length; i++ )
			{
				menuItems[ i ].addEventListener( clickEvent, _onItemClick );
			}

			// Attach preferences items events
			for ( let i = 0; i < prefTabs.length; i++ )
			{
				prefTabs[ i ].addEventListener( clickEvent, _onTabClick );
			}

			// Attach progress bar events
			document.getElementById( 'progress' ).addEventListener( mouseDownEvent, n.onBarDown );
			document.getElementById( 'volume' ).addEventListener( mouseDownEvent, n.onBarDown );

			// Catch click on body and close windows if any
			document.body.addEventListener( clickEvent, n.closeAll );

			// Catch click on .window and stop bubbling, so we do not close the window on click
			document.querySelector( '.window' ).addEventListener( clickEvent, n.stopBubbling );

			// Listen for keyboard shortcuts and execute them if found.
			document.body.addEventListener( keyDownEvent, e =>
			{
				let keys = n.getKeys( e );
				let item = document.getElementById( 'keyboard-shortcuts' ).querySelector( `tr[data-keys="${keys.keyProperty.join( '+' )}"]` );

				if ( item )
				{
					n[ item.dataset.action ]();
					e.preventDefault();
				}

				// Close everything if Esc is pressed
				if ( 27 === e.keyCode )
				{
					n.closeAll();
					e.preventDefault();
				}
			} );

			// Double click on footer should bring the currently active item into the view
			document.getElementById( 'footer' ).addEventListener( dblClickEvent, _ =>
			{
				const activeItem = n.activeItem;

				if ( activeItem )
				{
					const playlistId = activeItem.closest( '.playlist' ).id;

					// Focus the tab in which the active item is
					if ( playlistId !== n.activePlaylistId )
					{
						n.changePlaylist( document.querySelector( `div[data-for="${playlistId}"]` ) );
					}

					// Scroll item into view
					scrollIntoViewIfOutOfView( activeItem );
				}
			} );

			// Support for create playlist when double clicking on empty space next to tabs
			document.getElementById( 'playlists-tabs' ).addEventListener( dblClickEvent, e => e.currentTarget === e.target && n.newPlaylist() );

			if ( n.pref.showWhatsNew )
			{
				n.showWhatsNew();
			}

			// Calculate time needed for Noisy to load
			let timerEnd = Date.now();
			n.log( 'startup', `${timerEnd - timerStart}<span class=\'ms\'>${n.lang.console.ms}</span>` );

			// n.googledrive.youTubeSearch( 'Metallica One' );

			return Promise.resolve();
		} );
	},

	/**
	 * Adds animations if user enabled the option.
	 */
	initAnimations()
	{
		// Enable animations only if user said so
		let rules = [];

		if ( !n.powerSaveMode && n.pref.settings.checkboxes[ 'preference-enable-animations' ] )
		{
			const duration    = '.5s';
			const timing      = 'linear';
			const last        = ` ${duration} ${timing}`;
			const join        = `${last},`;
			const transitions = {
				'#the-menu,#splash'                                                                               : [ 'opacity', 'visibility' ],
				'.preferences-item,.add-item'                                                                     : [ 'background', 'color' ],
				'#drop-zone'                                                                                      : 'border',
				'.window,.cloud-icon,#battery-level-menu-handle:hover,.menu-ul-li:hover,[data-menulistener]:hover': 'opacity',
				'#color-bulb'                                                                                     : 'color',
				'#header,#playlists-wrapper,#footer,#add-window-files'                                            : 'filter'
			};

			rules = [ spinKeyframes ];

			Object.keys( transitions ).forEach( selector =>
			{
				let values = transitions[ selector ];

				// Support string, if only one transition will be used
				if ( !Array.isArray( values ) )
				{
					values = [ values ];
				}

				rules.push( `${selector}{transition:${values.join( join )}${last}}` );
			} );
		}

		document.getElementById( 'animations' ).innerHTML = rules.join( '' );
	},

	/**
	 * Adds blur if not in Power Save mode.
	 */
	initBlur()
	{
		let rules = [];

		if ( !n.powerSaveMode )
		{
			rules = [
				'.window-opened~*{filter:blur(5px)}',
				'#loading-folder-contents:not(.visibility-hidden)+#add-window-files:{filter:blur(5px)}'
			];
		}

		document.getElementById( 'blur' ).innerHTML = rules.join( '' );
	},

	/**
	 * Setups the HTML Audio element.
	 */
	initAudio()
	{
		n.audio.preload = 'auto';

		n.audio.id = 'audio';

		document.body.appendChild( n.audio );

		// When player can play it should
		n.audio.addEventListener( 'canplay', function ()
		{
			// Play if active audio is paused and inactive audio is not selected. This happens when playing for the
			// first time
			if ( n.audio.paused )
			{
				this.play();
			}
		} );

		// Change state of the item to playing when the player is playing
		n.audio.addEventListener( 'play', function ()
		{
			let idx        = parseInt( this.dataset.item, 10 );
			let playlistId = this.dataset.playlist;
			let item;
			let bold       = document.getElementById( 'playlists' ).querySelector( '.bold' );

			// Switch Play/Pause button to show Pause
			document.getElementById( 'trigger-play' ).dataset.icon = 'c';

			// Remove bold from previous element, if available
			if ( bold )
			{
				bold.classList.remove( 'bold' );
			}

			// Enable preloading of items when updateMeters is called and the progress is more than 50%
			//TODO: This is for knowing if we should initiate pre-load next time counters get updated. Maybe we can
			// find another way to do that without flags?
			n.preloaded = false;

			// If we have index for first item we need to play it
			if ( 'number' === typeof idx && !isNaN( idx ) )
			{
				//TODO: Get rid of this index thingy - too unstable if user changes positions of items
				item = document.getElementById( playlistId ).querySelectorAll( '.playlist-item' )[ idx ];
				n.setItemState( 'x', false, item );

				// Check if item is first in the queue
				if ( item === n.queue[ 0 ] )
				{
					n.removeFromQueue( item );
				}

				item.classList.add( 'bold' );
				n.setTitle( item );
				n.setFooter( item );
				n.notify( item );

				if ( n.lastfm.isAuthenticated )
				{
					n.lastfm.updateNowPlaying( item );
				}

				n.audio.dataset.start = Math.floor( Date.now() / 1000 );

				n.log( 'playbackStart', item.dataset.placeholder );
			}

			n.updateMeters();
		} );

		// Change state of the item to paused when the player is paused
		n.audio.addEventListener( 'pause', _ =>
		{
			// Switch Play/Pause button to show Play
			document.getElementById( 'trigger-play' ).dataset.icon = 'x';

			n.setItemState( 'c', false, document.getElementById( n.audio.dataset.playlist ).querySelectorAll( '.playlist-item' )[ parseInt( n.audio.dataset.item, 10 ) ] );
		} );

		// Play next item when current finnishes
		n.audio.addEventListener( 'ended', function ()
		{
			// Switch Play/Pause button to show Play
			document.getElementById( 'trigger-play' ).dataset.icon = 'x';

			let item = document.getElementById( this.dataset.playlist ).querySelectorAll( '.playlist-item' )[ parseInt( this.dataset.item, 10 ) ];
			let next = n.next( 'next', true );

			// Remove bold from currently playing item
			item.classList.remove( 'bold' );

			n.setItemState( null, false, item );

			if ( n.lastfm.isAuthenticated )
			{
				n.lastfm.scrobble();
			}

			if ( next )
			{
				n[ next.dataset.cloud ].play( next );
			}
		} );

		// Detect codecs support
		n.detectFormats();
	},

	/**
	 * Watches battery levels and enters power saving mode if user chose so when battery level is low
	 */
	initBatteryWatcher()
	{
		// Check for newer specification of Battery API
		if ( navigator.getBattery )
		{
			return navigator.getBattery().then( battery =>
			{
				n.battery = battery;
				n.battery.addEventListener( 'chargingchange', n.updateBatteryStatus );
				n.battery.addEventListener( 'levelchange', n.updateBatteryStatus );

				// Delay initial set, to wait for the proper Noisy initialization
				setTimeout( n.updateBatteryStatus, 1000 );
			} );
		}

		return Promise.reject( new Error( 'No Battery API support' ) );
	},

	/**
	 * Fills find window with items containing search term entered by the user.
	 */
	initSearch( val )
	{
		const results = document.getElementById( 'find-window-results' );

		results.innerHTML = '';

		if ( val )
		{
			const items = document.getElementById( 'playlists' ).querySelectorAll( 'article:not([hidden]) section[data-url]' );

			// We'll search by all words, so we split them
			const terms = val.split( ' ' );

			// Loop through all playlist items
			main: for ( let i = 0; i < items.length; i++ )
			{
				const item  = items[ i ];
				const url   = item.dataset.url.toLowerCase();
				// By default we have a match
				const title = item.querySelector( '.item-title' ).innerHTML.toLowerCase();

				// Loop through all search terms (words)
				for ( let j = 0; j < terms.length; j++ )
				{
					const term = terms[ j ];

					// If this term is not found in current item, mark item as not suitable and move on
					if ( !url.includes( term ) && !title.includes( term ) )
					{
						continue main;
					}
				}

				const cloning = item.cloneNode( true );

				// Remove queue and duration elements from the cloning
				cloning.querySelector( '.playback-options' ).remove();
				cloning.querySelector( '.item-duration' ).remove();

				results.appendChild( cloning );

				// Add event listeners for the cloning
				cloning.addEventListener( 'mousedown', n.onRowDown );
				cloning.addEventListener( 'dblclick', n.onRowDblClick );
			}
		}
	},

	initWhatsNew()
	{
		document.getElementById( 'whats-new-content' ).innerHTML = n.lang.whatsnew.map( whatsnew => `<div class="flex">
				<i data-icon="o"></i>
				<div>${whatsnew}</div>
			</div>`
		).join( '' );
	},

	/**
	 * Loads all the playlists in localStorage and renders them.
	 */
	loadAndRenderPlaylists()
	{
		let playlists = n.loadPlaylists();

		// Continue only if there are playlists saved
		if ( playlists )
		{
			// Iterate through all the saved playlists
			playlists.forEach( playlist =>
			{
				if ( playlist.id && playlist.name && playlist.items )
				{
					// Create tab and playlist DOM elements
					n.createPlaylist( playlist.name, playlist.id, false );

					// Fill the playlist with the saved data
					n.fillPlaylist( playlist.id, playlist.items, false );
				}
				else
				{
					n.error( 'error-loading-playlist', playlist.name || playlist.id );
				}
			} );
		}
	},

	/**
	 * Creates and fills playlist with loaded data passed as an arguments.
	 * @param {Object} playlist Required. Playlist object containing id, name and items properties
	 */
	loadPlaylist( playlist )
	{
		// Cannot continue if id, name and items properties are not available or the playlist param is not passed
		if ( !playlist || !playlist.id || !playlist.name || !playlist.items )
		{
			n.error( 'error-loading-playlist', playlist ? (playlist.id || playlist.name || '') : '' );
			return;
		}

		let tab = document.querySelector( `div[data-for="${playlist.id}"]` );

		if ( tab )
		{
			// Delete playlist because it'll be recreated again.
			n.deletePlaylist( { currentTarget: tab } );
		}

		n.createPlaylist( playlist.name, playlist.id );
		n.fillPlaylist( playlist.id, playlist.items, true );
	},

	/**
	 * Loads all saved playlists.
	 *
	 * @return {Object} Array with playlists if playlist found, otherwise null.
	 */
	loadPlaylists()
	{
		// Load playlists
		let playlists = localStorage.getItem( 'playlists' );

		// Parse JSON and retrun value
		if ( playlists )
		{
			return JSON.parse( playlists );
		}
		// Otherwise return null
		else
		{
			//todo: Maybe return empty array to keep returned value consistent and remove useless checks on other places
			return null;
		}
	},

	/**
	 * Gets first selected item from files window and sends it to the corresponding cloud object to try loading it as a
	 * playlist.
	 */
	loadPlaylistFromCloud()
	{
		let src      = document.getElementById( 'add-window-files' );
		let selected = src.querySelectorAll( '.active' );
		let cloud    = src.dataset.cloud;

		if ( cloud )
		{
			for ( let i = 0; i < selected.length; i++ )
			{
				n[ cloud ].loadNoisyFile( selected[ i ] ).then( response =>
				{
					if ( 'playlist' === response.type )
					{
						n.loadPlaylist( response );

						let tab = document.querySelector( `li[data-for="${response.id}"]` );

						if ( tab )
						{
							n.changePlaylist( tab );
						}
					}
					else
					{
						throw new Error( 'Not a valid playlist' );
					}
				} );
			}
		}

		n.closeAll();
	},

	/**
	 * Gets first selected item from files window and sends it to the corresponding cloud object to try loading it as
	 * preferences.
	 */
	loadPreferencesFromCloud()
	{
		let src      = document.getElementById( 'add-window-files' );
		let selected = src.querySelectorAll( '.active' );
		let cloud    = src.dataset.cloud;

		if ( selected.length && cloud )
		{
			n[ cloud ].loadNoisyFile( selected[ 0 ] ).then( response =>
			{
				if ( 'preferences' === response.type )
				{
					delete response.type;
					n.pref.import( response );
				}
				else
				{
					throw new Error( 'Not a valid preferences file' );
				}
			} );
		}
	},

	/**
	 * Adds a line to the console.
	 * @param {String} section Required. Contains property name in the
	 * language object for the action we are logging.
	 * @param {String} data Required. Text to be printed in the console.
	 */
	log( section, data = '' )
	{
		n.console.innerHTML += `<div><span class="${section}">${n.lang.console[ section ]}</span>${data}</div>`;
	},

	/**
	 * Extracts the data from a playlist and prepares it to be saved later.
	 * @param {String} id Required. Id of the playlist to be processed.
	 * @return {Array} Array of objects containing item's data
	 */
	makePlaylistItems( id )
	{
		// Select playlist's items
		let items  = document.getElementById( id ).querySelectorAll( '.playlist-item:not([data-cloud="local"])' );
		let toSave = [];

		// Iterate all items
		for ( let i = 0; i < items.length; i++ )
		{
			// Clone dataset object into a new one
			toSave.push( Object.assign( {}, items[ i ].dataset ) );
		}

		// Return the array of objects as a result
		return toSave;
	},

	/**
	 * Moves the item being dragged before/after it's previous/next sibling
	 * @param {String} position Should it be before or after the sibling. This is directly passed as forst param to
	 *     insertAdjacentElement()
	 * @param {Element} target Sibling
	 */
	moveElement( position, target )
	{
		target.insertAdjacentElement( position, n.movingItem );

		// Indicate that save should be happen on drag end
		n.movingShouldSave = true;
	},

	/**
	 * Create playlist.
	 */
	newPlaylist()
	{
		let name = n.lang.other[ 'new-playlist' ];
		let tab  = n.createPlaylist( name, `playlist-${Date.now()}`, true );

		if ( tab )
		{
			n.renamePlaylist( { currentTarget: tab.querySelector( '.playlist-name' ) } );
		}
	},

	/**
	 * Chooses previous/next item depending on the playback order set by the user.
	 * Next song may not be chosen if the song is the last in the
	 * playlist.
	 */
	next( direction, shouldReturn )
	{
		// Do nothing if there is loading item
		if ( n.waitingItem )
		{
			return;
		}

		// Get current item and set next item to null
		let item     = n.activeItem;
		let next     = null;
		let selected = n.currentlySelectedItem;
		let idx      = document.getElementById( 'playback-order' ).selectedIndex;

		// If user wants to repeat the same item don't do anything - audio.loop is set to true
		if ( 2 === idx )
		{
			return;
		}

		// Assume next item if no direction is passed
		if ( 'string' !== typeof direction )
		{
			direction = 'next';
		}

		// Reset title/statusbar to default if not returning the item in the end
		if ( !shouldReturn )
		{
			n.setTitle( null, true );
			n.setFooter( null, true );
		}

		// Cannot continue if current item is not found
		if ( !item )
		{
			return;
		}

		// Play next song depending on user's selection if any
		if ( n.pref.playbackFollowsCursorEnabled && selected && 4 !== idx )
		{
			next = selected;
		}
		else if ( 'next' === direction && n.queue.length )
		{
			next = n.queue[ 0 ];
		}

		if ( !next )
		{
			// Choose next item depending on the playback order set by the user
			switch ( idx )
			{
				// Default mode
				case 0:
					next = item[ `${direction}Sibling` ];
					break;

				// Repeat playlist mode
				case 1:
					next = item[ `${direction}Sibling` ];
					if ( !next )
					{
						next = n.getAllItems();

						// Get the last item if previous item is required
						if ( 'previous' === direction )
						{
							next = next.item( next.length - 1 );
						}
						else
						{
							next = next.item( 0 );
						}
					}
					break;

				// Random mode
				case 3:
					let items = n.getAllItems();
					next      = items[ Math.floor( (Math.random() * items.length) ) ];
					break;
			}
		}
		// Otherwise set player to stop state, but only if not being set to return as pre-loading shouldn't brake
		// visualization of currently playing item
		else if ( !shouldReturn )
		{
			n.setItemState();
		}

		// Return next item if requested
		if ( shouldReturn )
		{
			return next;
		}

		// Remove state classes from current item
		if ( item )
		{
			n.setItemState();
		}

		// Put state classes to next item and play it if available
		if ( next )
		{
			next.querySelector( '.playback-status' ).dataset.icon = 'w';
			n.play( next );
		}
		// Otherwise stop HTML Audio if it is paused (used to stop the
		// player when it's paused and user clicked next, but no next
		// is chosen because of the playing order)
		else if ( !n.audio.paused )
		{
			n.stop();
		}
	},

	/**
	 * Plays a random item by manipulating the playback order.
	 */
	nextRandom()
	{
		// Get playback order and save it for later use
		let order = document.getElementById( 'playback-order' );
		let idx   = order.selectedIndex;

		// Set the playback order to Random
		order.selectedIndex = 3;

		// Play the next song
		n.next();

		// Return the playback order to the previous setting
		order.selectedIndex = idx;

		n.toggleAlternate( document.getElementById( 'trigger-next' ) );
	},

	/**
	 * Pop a desktop notification to the user with the item being played.
	 * @param {HTMLElement} [item] Item from which we need to get the information shown in the notification.
	 *     If not supplied the active item will be chosen.
	 * @param {Boolean} [request] If true only a permission request will be sent to the user.
	 */
	notify( item = n.activeItem, request )
	{
		// We don't do notifications if we are in power save mode
		if ( !n.powerSaveMode )
		{
			// Request desktop notification permission if not already and user wants to
			if ( request && Notification.permission !== 'granted' )
			{
				//todo: Convert this to Promise based version once Edge and Safari implement it
				Notification.requestPermission( status =>
				{
					if ( Notification.permission !== status )
					{
						Notification.permission = status;
					}
				} );
			}
			else if ( 'undefined' === typeof request && n.pref.notify )
			{
				// If the user agreed to get notified
				if ( Notification && Notification.permission === 'granted' )
				{
					let notification = new Notification( n.lang.other[ 'notification-title' ], {
						icon: document.getElementById( 'notify-logo' ).href,
						body: n.formatString( document.getElementById( 'preference-notification-popup-format' ).value, item )
					} );

					notification.onshow = function ()
					{
						setTimeout( notification.close.bind( this ), 3000 );
					};
				}

				// If the user hasn't told if he wants to be notified or not
				// Note: because of Chrome, we are not sure the permission property
				// is set, therefore it's unsafe to check for the "default" value.
				else if ( 'undefined' !== typeof Notification && Notification.permission !== 'denied' )
				{
					Notification.requestPermission( status =>
					{
						if ( Notification.permission !== status )
						{
							Notification.permission = status;
						}

						// If the user said okay
						if ( status === 'granted' )
						{
							let notification = new Notification( n.lang.other[ 'notification-title' ], {
								icon: document.getElementById( 'notify-logo' ).href,
								body: n.formatString( document.getElementById( 'preference-notification-popup-format' ).value, item )
							} );

							notification.onshow = function ()
							{
								setTimeout( notification.close.bind( this ), 3000 );
							};
						}
					} );
				}
			}
		}
	},

	/**
	 * Handler for mousedown event in the files window.
	 * @param {Event} e Required.
	 */
	onAddItemDown( e )
	{
		// Need to remove all selected items if current item is being selected without Ctrl/Shift keys (without
		// multi-selection)
		if ( !e.ctrlKey && !e.shiftKey )
		{
			let items          = document.getElementById( 'add-window-files' ).querySelectorAll( '.add-item' );
			const activeString = 'active';

			for ( let i = 0; i < items.length; i++ )
			{
				items[ i ].classList.remove( activeString );
			}
		}

		n._selectItems.call( this, e, 'add-window-files', '.add-item', 'active' );

		// Apply windows state depending on if the item chosen is a file or folder
		if ( 'false' === this.dataset.folder )
		{
			n.applyWindowState( 'file' );
		}
		else
		{
			n.applyWindowState( 'all' );
		}
	},

	/**
	 * Handler for dblclick event in the files window.
	 */
	onAddItemDblClick()
	{
		// Open folder if item is a folder
		if ( 'true' === this.dataset.folder )
		{
			n.openFolder();
		}
		// Otherwise load file depending on the type of the file window
		else
		{
			let id = document.querySelector( '.window' ).id;

			switch ( id )
			{
				case 'load-playlist-window':
					n.loadPlaylistFromCloud();
					break;
				case 'load-preferences-window':
					n.loadPreferencesFromCloud();
					break;
				default:
					n.addFileFolder();
			}
		}
	},

	/**
	 * Event handler called on when user starts to drag volume or progress bars
	 * @param {Event} e Event is needed to get the reference to the dragged bar
	 */
	onBarDown( e )
	{
		n.movingItem = e.currentTarget;

		document.body.addEventListener( 'mousemove', n.onBarMove );
		document.body.addEventListener( 'mouseup', n.onBarUp );
	},

	/**
	 * Event handler called on mouse move over the body. Used for dragging volume/progress bars.
	 * @param {Event} e Required. Mouse event from which data will be extracted and used in calculations.
	 */
	onBarMove( e )
	{
		let bar          = n.movingItem;
		let boundingRect = bar.getBoundingClientRect();
		let x            = e.pageX - boundingRect.left;
		let width        = bar.offsetWidth;
		let diff         = Math.min( Math.max( 0, x ), width );
		let percents     = diff * 100 / width;

		// Set audio progress if playback's progress bar is being dragged
		if ( 'progress' === bar.id && !n.audio.paused )
		{
			n.audio.currentTime = n.audio.duration * percents / 100;

			// Set bar only if playing
			n.setProgress( bar, percents );
		}
		// Otherwise if volume's bar is dragged, then set audio volume
		else if ( 'volume' === bar.id )
		{
			n.pref.volume = percents / 100;
		}
	},

	/**
	 * Event handler called on mouse up over the body. Used for dragging elements.
	 *
	 * @param {Event} e Required. Mouse event from which data will be extracted and used in calculations.
	 */
	onBarUp( e )
	{
		// If user clicks on the bar instead of dragging, we still need to set the progress of the bar
		n.onBarMove( e );

		// Reset variables as drag is over
		n.movingItem = null;

		document.body.removeEventListener( 'mousemove', n.onBarMove );
		document.body.removeEventListener( 'mouseup', n.onBarUp );
	},

	/**
	 * On delete keyboard shortcut click event handler. Deletes the
	 * row from the DOM and saves the preferences.
	 *
	 * @param {HTMLElement} button. Buttom clicked.
	 */
	onDeleteKeyboardShortcut( button )
	{
		// Get the row on which the delete button was clicked
		let row = button.closest( 'tr' );

		// Get row index
		let idx = Array.prototype.indexOf.call( row.closest( 'tbody' ).children, row );

		// Remove the row
		row.remove();

		// Save preferences
		n.pref.deleteKey = idx;
	},

	/**
	 * Event handler called on click on the one tab setting in the preferences window.
	 * Toggles visibility on the tabs if only one tab is available.
	 */
	oneTabCheck()
	{
		if (
			document.getElementById( 'preference-hide-playlist-tabs' ).checked &&
			2 === document.querySelectorAll( '.playlists-tabs-li' ).length
		)
		{
			document.body.classList.add( 'one-tab' );
		}
		else
		{
			document.body.classList.remove( 'one-tab' );
		}
	},

	/**
	 * Calls changeLanguage() with the selected value of the language dropdown.
	 *
	 * @param {HTMLElement} select Required. HTML select element from which the value will be taken.
	 */
	//TODO: Maybe in index.html use
	//<select id="preference-user-language" onchange="n.changeLanguage(this.value)">
	//instead of
	//<select id="preference-user-language" onchange="n.onLanguageChange(this)">
	//and drop this function
	onLanguageChange( select )
	{
		n.changeLanguage( select.value );
	},

	/**
	 * List folder contents in the files window.
	 */
	openFolder()
	{
		let selected = document.getElementById( 'add-window-files' ).querySelector( '.active' );

		document.getElementById( 'loading-folder-contents' ).classList.remove( 'visibility-hidden' );

		n[ selected.dataset.cloud ].getFolderContents( selected.dataset.path );
	},

	/**
	 * Handler for change event on checkboxes for cursor behaviour.
	 */
	onCursorCheckboxChange()
	{
		// If one of the two checkboxes is checked, un-check the other
		if ( this.checked )
		{
			// ids of the two checkboxes
			let ids = [ 'preference-cursor-follows-playback', 'preference-playback-follows-cursor' ];

			// Remove the id of the checked checkbox
			ids.splice( ids.indexOf( this.id ), 1 );

			// The remaining id is the id of the checkbox needed to be unchecked
			document.getElementById( ids[ 0 ] ).checked = false;
		}
	},

	/**
	 * Handles local files supplied by the user.
	 * @param {Event} e Required. Event from which to get the files.
	 * @returns {boolean}
	 */
	onFilesSupplied( e )
	{
		const files = Array.from( e.files || e.dataTransfer.files );
		let id      = n.activePlaylistId;

		// Create new playlist to which to add the files if the user hasn't selected any
		if ( !id )
		{
			n.newPlaylist();
			id = n.activePlaylistId;
		}

		// Create store for local files for this playlist, if it doesn't exist
		n.local.files[ id ] = n.local.files[ id ] || [];

		// Save original length of local files before the addition of new onces - used to properly calculate position
		// of the processed file
		const lengthBefore = n.local.files[ id ].length;

		n.fillPlaylist( id, files.map( ( file, index ) =>
		{
			n.local.files[ id ].push( file );

			return {
				cloud      : 'local',
				//TODO: Check if browser supports there formats instead of replacing them, and if it is - add them to
				//the first check, so we have them in n.formats
				mimetype   : file.type.replace( 'mp3', 'mpeg' ).replace( 'x-m4a', 'mp4' ),
				placeholder: file.name,
				url        : lengthBefore + index
			};
		} ), false );

		// Don't wait for tag reading to close the window - this gives user a feel of speed
		n.closeAll();

		// Empty selected files.
		//TODO: We are using DOM selection because onFilesSupplied is being called from two places - the input itself
		// and on drop. Drop produces normal event, but it's not related to the input in anyway. Input change passes
		// the input itself instead of event. Fix this part.
		document.getElementById( 'selected-playback-files' ).value = '';

		// Read tags, if not in a Power Save mode
		if ( !n.powerSaveMode )
		{
			files.forEach( ( file, index ) =>
			{
				const fr   = new FileReader();
				const item = document.querySelector( `#${id} .playlist-item[data-url="${lengthBefore + index}"]` );

				// Show loading indicator when reading tags
				n.setItemState( 'w', false, item, false );

				// Start listening for when current file is loaded
				fr.addEventListener(
					'load',
					event =>
					{
						n.readTags( event.target.result, file.name.split( '.' ).pop() )
							.then( tags =>
							{
								// Hide loading indicator
								n.setItemState( null, false, item );

								// Update tags
								n.updateItemTags( tags, item );
							} );
					},
					{ once: true }
				);

				fr.readAsArrayBuffer( file );
			} );
		}

		return false;
	},

	onPowerSaverStateChange( select )
	{
		n.pref.powerSaverState = select.value;
		n.updateBatteryStatus();
	},

	onRenameKeyDown( e )
	{
		const keyCode = e.keyCode;

		// We should stop bubbling while renaming in order to prevent Noisy's keyboard shortcuts from kicking in.
		e.stopPropagation();

		if ( 13 === keyCode )
		{
			e.preventDefault();
			n.playlistNameCheck();
		}
		else if ( 27 === keyCode )
		{
			e.preventDefault();

			const title = e.currentTarget;

			title.innerHTML = title.closest( '[data-for]' ).dataset.name;

			n.stopRenames();
		}
	},

	/**
	 * On item double click event handler. Plays the clicked item.
	 */
	onRowDblClick()
	{
		n.setItemState();

		n.play();
	},

	/**
	 * Event handler called on mouse down over playlist item. Used for dragging items.
	 * @param {Event} e Required. Mouse event from which data will be extracted and used in calculations.
	 * @this {HTMLElement} Playlist item.
	 */
	onRowDown( e )
	{
		let clickedElement = e.target;
		let row            = e.currentTarget;

		// Delete selected items if the user has clicked on the trash can on some of them, then on the confirm icon
		if ( row.classList.contains( 'confirmation' ) && clickedElement.classList.contains( 'delete-icon' ) )
		{
			return n.deleteItems();
		}
		// Otherwise add confirmation to the row
		else if ( clickedElement.classList.contains( 'delete-icon' ) )
		{
			return row.classList.add( 'confirmation' );
		}
		// Otherwise check if user clicked add to queue icon and add the item to the queue if true
		else if ( clickedElement.classList.contains( 'item-add-to-queue' ) )
		{
			return n.addToQueue( row );
		}
		// If not, check if user clicked remove from queue icon and remove the item from the queue
		else if ( clickedElement.classList.contains( 'item-remove-from-queue' ) )
		{
			return n.removeFromQueue( row );
		}

		requestAnimationFrame( _ =>
		{
			// Deselect previous items if not in a multi-select mode
			if ( !e.ctrlKey && !e.shiftKey )
			{
				n._deselectItems();
			}

			// Select clicked item depending on the keyboard keys pressed
			n._selectItems.call( row, e, n.activePlaylistId, '.playlist-item', 'selected' );

			// Manage search results, if window is opened
			if ( document.getElementById( 'find-window-results' ).contains( row ) )
			{
				let toSelect        = document.querySelectorAll( '.window .selected' );
				const selectedClass = 'selected';
				let selected        = document.querySelectorAll( `#${n.activePlaylistId} .selected` );

				// Deselect all selected items from the current playlist
				for ( let i = 0; i < selected.length; i++ )
				{
					selected[ i ].classList.remove( selectedClass );
				}

				for ( let i = 0; i < toSelect.length; i++ )
				{
					document.getElementById( n.activePlaylistId ).querySelector( `section[data-url="${toSelect[ i ].dataset.url}"]` ).classList.add( selectedClass );
				}

				let el = document.getElementById( n.activePlaylistId ).querySelector( `section[data-url="${row.dataset.url}"]` );

				el.classList.add( selectedClass );

				scrollIntoViewIfOutOfView( el );
				scrollIntoViewIfOutOfView( row );
			}
		} );

		n.movingItem       = e.currentTarget;
		n.movingItemHeight = row.offsetHeight;
		n.movingStart      = e.clientY;

		document.body.addEventListener( 'mousemove', n.onRowMove );
		document.body.addEventListener( 'mouseup', n.onRowUp );
	},

	/**
	 * Event handler called on mouse move over the body. Used for dragging playlist items.
	 * @param {Event} e Required. Mouse event from which data will be extracted and used in calculations.
	 */
	onRowMove( e )
	{
		// Get y position of the mouse
		let y    = e.clientY;
		// Get the difference between current mouse position and starting one
		let diff = n.movingStart - y;

		// Move item in the DOM only if it's moved more than it's height
		if ( Math.abs( diff ) > n.movingItemHeight )
		{
			let itm;
			let position;
			// Get all items only when we are about to move
			let items = n.getAllItems();
			// Get index of currently dragged item
			let idx   = Array.prototype.indexOf.call( items, n.movingItem );

			// Move the item in the right direction on the Y axis
			if ( 0 < diff )
			{
				// Check if there is previous item
				itm      = items[ idx - 1 ];
				position = 'beforebegin';

			}
			else
			{
				// Check if there is next item
				itm      = items[ idx + 1 ];
				position = 'afterend';
			}

			// Move dragged item only if there is item to place it before
			if ( itm )
			{
				n.moveElement( position, itm );

				// Save new starting position
				n.movingStart = y;
			}
		}
	},

	/**
	 * Event handler called on mouse up over the body. Used for dragging elements.
	 */
	onRowUp()
	{
		// Save if something has changed
		if ( n.movingShouldSave )
		{
			n.savePlaylist( document.getElementById( n.activePlaylistId ) );
		}

		// Reset variables as drag is over
		n.movingItem       = null;
		n.movingItemHeight = n.movingStart = -1;
		n.movingShouldSave = false;

		document.body.removeEventListener( 'mousemove', n.onRowMove );
		document.body.removeEventListener( 'mouseup', n.onRowUp );
	},

	/**
	 * Fired on key up when user types in the filename box in save playlist/preferences dialog.
	 * @param {Event} e
	 */
	onSaveNameInput( e )
	{
		let val = e.currentTarget.value.trim();

		if ( !e.altKey && !e.altGraphKey && !e.ctrlKey && !e.shiftKey && val )
		{
			n.applyWindowState( 'save' );
		}
		else if ( !val )
		{
			n.applyWindowState( 'semi' );
		}
	},

	/**
	 * Event handler called on change of theme dropdown. Used for changing themes.
	 * @param {HTMLElement} select Required. HTML select element from which theme name will be taken.
	 */
	onStyleChange( select )
	{
		// Change the theme of Noisy
		n.changeStyle( select.value );
	},

	/**
	 * On tab click event handler. Switches tabs.
	 */
	onTabClick( e )
	{
		const target = e.currentTarget;

		// Stop click event propagation because if it reaches body it'll accept renaming - user might just be moving
		// the caret to correct the text.
		e.stopPropagation();

		// Select playlist
		if ( 'add-playlist' === target.id )
		{
			n.newPlaylist();
		}
		else
		{
			n.changePlaylist( target );
		}
	},

	/**
	 * Event handler called on mouse down over tab item. Used for dragging tabs.
	 * @param {Event} e Required. Mouse event from which data will be extracted and used in calculations.
	 */
	onTabDown( e )
	{
		n.movingItem  = e.currentTarget;
		n.movingStart = e.clientX;

		document.body.addEventListener( 'mousemove', n.onTabMove );
		document.body.addEventListener( 'mouseup', n.onTabUp );
	},

	/**
	 * Event handler called on mouse move over the body. Used for dragging playlist tabs.
	 * @param {Event} e Required. Mouse event from which data will be extracted and used in calculations.
	 */
	onTabMove( e )
	{
		let width;
		let position;
		let itm;
		let items = document.querySelectorAll( '.playlists-tabs-li' );
		// Get index of currently dragged item
		let idx   = Array.prototype.indexOf.call( items, n.movingItem );
		// Tabs are dragged only horizontally, so get current mouse position on X axis
		let x     = e.clientX;
		// Get the difference between current mouse position and starting one
		let diff  = n.movingStart - x;

		// Move the item in the right direction on the X axis
		if ( 0 < diff )
		{
			// Check if there is previous item
			itm      = items[ idx - 1 ];
			position = 'beforebegin';
		}
		else
		{
			// Check if there is next item
			itm      = items[ idx + 1 ];
			position = 'afterend';
		}

		// Move dragged item only if there is item to place it before
		if ( itm && 'add-playlist' !== itm.id )
		{
			// Get p revious item's width
			width = itm.offsetWidth;

			// Move item in the DOM only if moved over the whole previous element
			if ( Math.abs( diff ) > width )
			{
				n.moveElement( position, itm );

				// Save new starting position
				n.movingStart = x;
			}
		}
	},

	/**
	 * Event handler called on mouse up over the body. Used for dragging tabs.
	 */
	onTabUp()
	{
		// Save if something has changed
		if ( n.movingShouldSave )
		{
			n.savePlaylists();
		}

		// Reset variables as drag is over
		n.movingItem       = null;
		n.movingStart      = -1;
		n.movingShouldSave = false;

		document.body.removeEventListener( 'mousemove', n.onTabMove );
		document.body.removeEventListener( 'mouseup', n.onTabUp );
	},

	/**
	 * Plays an item.
	 *
	 * @param {*} [item] Optional. If an HTMLElement is passed, it'll
	 * be used to read data from it and play it. Otherwise selected item
	 * will be chosen as data source.
	 */
	play( item = {} )
	{
		// Check if HTMLElement is passed and use selected if not. Play
		// button's click event points here, so item can be event object.
		if ( !item.tagName )
		{
			item = n.currentlySelectedItem;

			// There is no selected item, so we cannot continue
			if ( !item )
			{
				return;
			}
		}

		// Select item if cursor follows playback
		if ( n.pref.cursorFollowsPlaybackEnabled )
		{
			n._deselectItems();
			n._selectItems.call( item, {}, n.activePlaylistId, '.playlist-item', 'selected' );
		}

		let cloud = n.getCloud( item );

		// Initialize player if not already
		if ( !n.audio.parentNode )
		{
			n.initAudio();
		}

		// Authenticate with cloud service if not already
		if ( !n[ cloud ].isAuthenticated )
		{
			// Connect to the cloud service
			return n[ cloud ].connect();
		}

		n.log( 'playbackWait', item.dataset.placeholder );

		n.setTitle( item );
		n.setFooter( item );

		// Load file from cloud service
		n[ cloud ].play( item );
	},

	/**
	 * Check if name is not empty and create playlist
	 */
	playlistNameCheck()
	{
		const title = document.querySelector( `div[data-for="${n.activePlaylistId}"] .playlist-name` );
		const name  = title.innerHTML.trim();

		if ( name )
		{
			// Are we renaming an existing playlist?
			if ( title.contentEditable )
			{
				document.querySelector( `#playlists-tabs [data-for="${n.activePlaylistId}"]` ).dataset.name = name;
				n.savePlaylist( document.getElementById( n.activePlaylistId ) );
			}
			// or we are creating a new one
			else
			{
				n.createPlaylist( name, n.activePlaylistId, true );
			}

			n.stopRenames();
		}
	},

	/**
	 * Pause/Resume HTML Audio playback.
	 */
	playPause()
	{
		// Check if paused and play if it is
		if ( n.audio.paused && n.activeItem )
		{
			n.audio.play();
		}
		// otherwise pause
		else if ( n.activeItem )
		{
			n.audio.pause();
		}
		// If no active item, we need to play the selected/first item in the playlist
		else
		{
			n.play();
		}
	},

	/**
	 * Calls next method with previous direction.
	 */
	prev()
	{
		// Next item should be the previous one, so tell that to next()
		n.next( 'previous' );
	},

	/**
	 * Reads tags for MP3, OGG, M4A and OPUS files.
	 * @param {ArrayBuffer} buffer Required. File represented in an array buffer.
	 * @param {String} extension Required. File extension. Used to determine which algorithm to apply when reading tags.
	 * @returns {Promise} Promise that will resolve with read tags as first argument.
	 */
	readTags( buffer, extension )
	{
		return new Promise( resolve =>
		{
			const worker = new Worker( '/js/tagReader.js?ver=' + version );
			worker.postMessage( { buffer, extension } );
			worker.onmessage = event => resolve( event.data );
		} );
	},

	/**
	 * Removes items from the playlist
	 */
	removeFromPlaylist()
	{
		let selectedRows = document.getElementById( n.activePlaylistId ).querySelectorAll( '.playlist-item.selected' );
		let len          = selectedRows.length;
		let confirm      = 0;

		for ( let i = 0; i < len; i++ )
		{
			let row = selectedRows[ i ];
			if ( row.classList.contains( 'confirmation' ) )
			{
				confirm++;
			}
			else
			{
				row.classList.add( 'confirmation' );
			}
		}

		if ( len === confirm )
		{
			n.deleteItems();
		}
	},

	/**
	 * Remove item from playback's queue.
	 * @param {HTMLElement|EventTarget} [item] Optional. Item to be removed. If none passed, the selected one will be
	 *     taken.
	 */
	removeFromQueue( item = n.currentlySelectedItem )
	{
		// Get its index
		let idx = n.queue.indexOf( item );

		// Remove from queue if found in there
		if ( ~idx )
		{
			// Remove from queue array
			n.queue.splice( idx, 1 );

			// Remove queue number from users display
			item.querySelector( '.item-queue' ).innerHTML = '';

			// Update numbers of other queue items
			n.updateQueueStates();
		}
	},

	/**
	 * Re-renders all playlist items. Common use is when playlist item formatting is changed.
	 */
	refreshPlaylists()
	{
		// Select all items from both active and inactive playlists
		let items = document.getElementById( 'playlists' ).querySelectorAll( '.playlist-item' );

		// Re-render items
		for ( let i = 0; i < items.length; i++ )
		{
			n.renderItem( items[ i ] );
		}

		// Return variable to false, so next time we won't refresh it again
		n.shouldRefreshPlaylist = false;
	},

	/**
	 * Re-renders status bar. Common use is when status bar formatting is changed.
	 */
	refreshStatusbar()
	{
		// Get item being played
		let item = document.getElementById( 'playlists' ).querySelector( 'div[data-icon="x"]' );

		// Status bar refresh will commence only if there is an item being played
		if ( item )
		{
			n.setFooter( item.parentNode.parentNode );
		}

		// Return variable to false, so next time we won't refresh it again
		n.shouldRefreshStatusBar = false;
	},

	/**
	 * Changes window title. Common use is when window title formatting is changed.
	 */
	refreshWindowTitle()
	{
		// Get item being played
		let item = document.getElementById( 'playlists' ).querySelector( 'div[data-icon="x"]' );

		// Window title change will commence only if there is an item being played
		if ( item )
		{
			n.setTitle( item.parentNode );
		}

		// Return variable to false, so next time we won't refresh it again
		n.shouldRefreshWindowTitle = false;
	},

	/**
	 * Rename playlist dialog window.
	 */
	renamePlaylist( e )
	{
		const tab = e.currentTarget.closest( '[data-for]' );
		// n.renamePlaylist can be called either when double clicking on .playlist-name or when clicking on
		// .playlist-edit. In both cases we need to work with .playlist-name
		const title = tab.querySelector( '.playlist-name' );

		title.setAttribute( 'contenteditable', 'true' );

		document.body.addEventListener( 'click', n.playlistNameCheck, { once: true } );

		// Need to listen for Enter and Esc keys when renaming
		title.addEventListener( 'keydown', n.onRenameKeyDown );

		title.focus();

		n.changePlaylist( tab );

		document.execCommand( 'selectAll', false, null );
	},

	/**
	 * Render info to the screen.
	 * @param {HTMLElement} item Required. Item to which the changes should appear.
	 */
	renderItem( item )
	{
		let durationContainer = item.querySelectorAll( '.item-duration' );
		let duration          = item.dataset.duration || '';

		// Create duration container if not already created and fill it
		if ( !durationContainer.length )
		{
			item.innerHTML += `<span class="item-duration">${duration}</span><div class="delete-icon" tabindex="-1" data-icon="m"></div>`;
		}
		// Otherwise just fill the already there duration element
		else
		{
			durationContainer[ 0 ].innerHTML = duration;
		}

		// Render formatted string if some info available
		item.querySelector( '.item-title' ).innerHTML = n.formatString( document.getElementById( 'preference-playlist-format' ).value, item );
	},

	/**
	 * Renders the table with keyboard shortcuts in preferences window.
	 */
	renderKeyboardShortcuts()
	{
		// Remove previous rows, if any
		let rows = document.getElementById( 'keyboard-shortcuts' ).querySelectorAll( '.va' );

		for ( let i = 0; i < rows.length; i++ )
		{
			let row = rows[ i ];
			row.remove();
		}

		// Find appending place
		let insertBefore = document.getElementById( 'actions' );
		const tagName    = 'tr';

		while ( tagName !== insertBefore.tagName.toLowerCase() )
		{
			insertBefore = insertBefore.parentNode;
		}

		// Render all keyboard shortcuts
		let df                = document.createDocumentFragment();
		const elementToCreate = 'tr';
		const id              = 'actions';
		const splitString     = '+';
		const joinString      = ' + ';

		n.pref.keys.forEach( key =>
		{
			let tr     = document.createElement( elementToCreate );
			let action = document.getElementById( id ).querySelector( `option[value="${key.action}"]` ).innerHTML;
			let keys   = key.key.split( splitString );

			keys.forEach( ( k, i ) =>
			{
				keys[ i ] = keyCodes[ keys[ i ] ];
			} );

			keys = keys.join( joinString );

			// Fill the row with needed atributes and HTML
			n._prepareShortcutRow( tr, key.key, key.action, keys, action );

			df.appendChild( tr );
		} );

		// Append the fragment to the DOM
		insertBefore.parentNode.insertBefore( df, insertBefore );
	},

	/**
	 * Sets add-window in it's initial state.
	 */
	resetAddWindow()
	{
		n.emptyAddWindow();

		const source = document.getElementById( 'add-window-files' );

		// Show cloud selection
		document.getElementById( 'add-window-cloud-chooser' ).hidden = false;

		delete source.dataset.path;
		delete source.dataset.cloud;
		delete source.dataset.filter;

		// Hide loading indicator, in case user clicked X before loading finished
		document.getElementById( 'loading-folder-contents' ).classList.add( 'visibility-hidden' );
	},

	/**
	 * Restores Noisy to default preferences.
	 */
	restoreToDefaults()
	{
		let confirmation = document.querySelector( '#preferences-window-buttons .confirmation' );

		if ( confirmation )
		{
			confirmation.classList.remove( 'confirmation' );
		}

		localStorage.removeItem( 'preferences' );

		n.pref.settings = JSON.parse( JSON.stringify( n.pref.originalSettings ) );
		n.pref.process();

		n.changeScrobblingState( n.pref.settings.checkboxes[ 'preference-enable-scrobbling' ] );
		n.translate();
		n.initAnimations();
		n.initBlur();
		n.checkConnections();
		n.applyTheme();
		n.checkQuota();
		n.initWhatsNew();
	},

	/**
	 * Saves curently active playlist. An internal call to savePlaylist() with active playlist id is made.
	 * @param {Boolean} [shouldReturn] Optional. If passed and true,
	 * constructed object will be returned, otherwise the playlist will be saved.
	 * @param {Boolean} [rename] Optional. If passed, playlist will change
	 * name of the active playlist, to the value that is read from the DOM.
	 *
	 * @return {Object} Object representing the playlist.
	 */
	saveActivePlaylist( shouldReturn, rename )
	{
		return n.savePlaylist( document.getElementById( n.activePlaylistId ), shouldReturn, rename );
	},

	/**
	 * Saves only one playlist.
	 *
	 * @param {HTMLElement} playlist Required. The playlist to be saved.
	 * @param {Boolean} [shouldReturn] Optional. If passed and true,
	 * constructed object will be returned, otherwise the playlist will be saved.
	 *
	 * @return {Object} Object representing the playlist.
	 */
	savePlaylist( playlist, shouldReturn )
	{
		let id   = playlist.id;
		let tab  = document.querySelector( `#playlists-tabs [data-for="${id}"]` );
		let name = tab.querySelector( '.playlist-name' ).textContent;

		// Object that will represent the playlist
		let obj = { id, name, items: n.makePlaylistItems( id ) };

		// Return object if it should
		if ( shouldReturn )
		{
			return obj;
		}

		// Load all playlists
		let playlists = n.loadPlaylists();
		let notFound  = true;

		// Iterate all playlists
		for ( let i = 0; i < playlists.length; i++ )
		{
			// Replace found playlist with obj in case they are the same playlists
			if ( playlists[ i ].id === obj.id )
			{
				playlists[ i ] = obj;
				notFound       = false;
				break;
			}
		}

		// Save the new playlist if no old one found
		if ( notFound )
		{
			playlists.push( obj );
		}

		// Save playlists
		localStorage.setItem( 'playlists', JSON.stringify( playlists ) );
	},

	/**
	 * Save all playlists in the localStorage.
	 */
	savePlaylists()
	{
		// Save to localStorage as JSON string
		localStorage.setItem( 'playlists', JSON.stringify(
			Array.from( document.getElementById( 'playlists' ).querySelectorAll( 'article.playlist' ) )
				.map( playlist => n.savePlaylist( playlist, true ) )
		) );
	},

	/**
	 * Saves currently active playlist to the cloud with the name user chosed in the files window.
	 */
	savePlaylistToCloud()
	{
		let src             = document.getElementById( 'add-window-files' );
		let val             = document.getElementById( 'save-playlist-window-filename' ).value.trim();
		let { path, cloud } = src.dataset;

		// To save we need valid (not empty) file name, path and cloud to which to save
		if ( val && path && cloud )
		{
			n.setFooter( n.lang.footer[ 'please-wait' ] );

			n[ cloud ].saveNoisyFile( `${val}.plst.nsy`, path );
		}

		n.closeAll();
	},

	/**
	 * Delayed save of the preferences. Used when user makes multiple request for save in a 2 second interval - they
	 * are combined into one.
	 */
	saveActivePlaylistIdDelayed()
	{
		clearTimeout( n.saveTimeout );
		n.saveTimeout = setTimeout( _ => n.pref.activePlaylistId = n.activePlaylistId, 1000 );
	},

	/**
	 * Saves preferences to the cloud with the name user chosed in the files window.
	 */
	savePreferencesToCloud()
	{
		let src             = document.getElementById( 'add-window-files' );
		let val             = document.getElementById( 'save-preferences-window-filename' ).value.trim();
		let { path, cloud } = src.dataset;

		// To save we need valid (not empty) file name, path and cloud to which to save
		if ( val && path && cloud )
		{
			n.setFooter( n.lang.footer[ 'please-wait' ] );

			n[ cloud ].saveNoisyFile( `${val}.pref.nsy`, path );
		}

		n.closeAll();
	},

	/**
	 * Switches from service icons window to files window and requests files for the chosen service.
	 * @param {String} service Required. Service which was chosen.
	 */
	selectService( service )
	{
		document.getElementById( 'add-window-cloud-chooser' ).hidden = true;
		document.querySelector( '.window' ).className                = `window ${service}`;

		n[ service ].getFolderContents( '' );
	},

	/**
	 * Set status bar's text.
	 *
	 * @param {*} [item] Optional. Item from which to get data. If not passed, selected one will be taken. Also string
	 *     can be passed for direct text print to the footer.
	 * @param {Boolean} [clear] Optional. If passed and true, status bar will be cleared before everything else.
	 */
	setFooter( item, clear )
	{
		let footerText = document.getElementById( 'footer-text' );

		if ( clear )
		{
			footerText.innerHTML                              = '';
			n.cancelAction                                    = true;
			document.getElementById( 'cancel-action' ).hidden = true;
		}
		else
		{
			if ( 'string' === typeof item )
			{
				footerText.innerHTML = item;
			}
			else
			{
				// Select selected item if no item is supplied
				if ( !item )
				{
					item = n.getItem( n.activePlaylistId );
				}

				// Set the status bar with the formated string
				footerText.innerHTML = n.formatString( document.getElementById( 'preference-status-bar-format' ).value, item );
			}
		}
	},

	/**
	 * Set state of current/selected item
	 * @param {String} [state] Optional. Class to add to the found item. Use without to make the player look like it's
	 *     not playing.
	 * @param {Boolean} [selected] Optional. Set class to the selected item instead of the found item. Used to when
	 *     play button is clicked for the first time and there is no other item currently playing.
	 * @param {HTMLElement} [item] Optional. Item to which the state should be set.
	 * @param {Boolean} [removePrevious] An option to stop removing passed state from previous place. Useful when
	 *     showing multiple loadings.
	 */
	setItemState( state, selected, item, removePrevious = true )
	{
		// Get currently active item or selected one on the currently active playlist
		item = item || document.querySelector( '.preloaded' ) || n.activeItem || n.currentlySelectedItem;

		item.classList.remove( 'preloaded' );

		// Get icon element in item
		item = item.querySelector( '.playback-status' );

		// Continue only if item found
		if ( item )
		{
			// State icons shouldn't repeat, so we should remove previous one
			let playbackStatus = removePrevious && document.getElementById( 'playlists' ).querySelector( `.playback-status[data-icon="${state}"]` );

			if ( playbackStatus )
			{
				delete playbackStatus.dataset.icon;
			}

			// Remove playback state of current item
			delete item.dataset.icon;

			// Apply icon if passed. Item to apply depends on the selected argument
			if ( selected && 'string' === typeof state )
			{
				item                                                  = n.currentlySelectedItem;
				item.querySelector( '.playback-status' ).dataset.icon = state;
			}
			else if ( 'string' === typeof state )
			{
				item.dataset.icon = state;
			}
		}
	},

	/**
	 * Sets the progress of a progress bar.
	 *
	 * @param {HTMLElement} bar Required. Progress bar to which changes will apply.
	 * @param {Number} percents Required. Number between 0 and 100. Used to advance the progress bar.
	 */
	setProgress( bar, percents )
	{
		let oldPercents = parseInt( bar.children[ 0 ].style.width );

		// Update bar only if different (minimize redraw)
		if ( oldPercents !== percents )
		{
			// Change volume icon if the bar to set progress is volume bar
			if ( document.getElementById( 'volume' ) === bar && !n.audio.muted )
			{
				document.getElementById( 'trigger-mute' ).dataset.icon = Math.min( 3, Math.round( n.audio.volume / 0.33 ) + 1 );
			}

			// Set progress bar's progress
			bar.children[ 0 ].style.width = `${percents}%`;
		}
	},

	/**
	 * Set window title.
	 *
	 * @param {HTMLElement} [item] Optional. Item from which to get data. If not passed, selected one will be taken.
	 * @param {Boolean} [clear] Optional. If passed and true, window title will be reset to default before everything
	 *     else.
	 */
	setTitle( item, clear )
	{
		if ( clear )
		{
			document.title = n.lang.title;
		}
		else
		{
			// Select selected item if no item is supplied
			if ( !item )
			{
				item = n.getItem( n.activePlaylistId );
			}

			// Set the title of the window with the formated string
			document.title = n.formatString( document.getElementById( 'preference-window-title-format' ).value, item );
		}
	},

	/**
	 * Extracts the link for a YouTube video based on the social link clicked and shares it in the desired social media
	 * @param {HTMLElement} socialIcon Required. Social media icon on which the user clicked.
	 */
	shareYouTubeLink( socialIcon )
	{
		debugger;
	},

	//TODO: Combine all the show*() into one

	/**
	 * Shows about window.
	 */
	showAbout()
	{
		// Create window dialog
		n.window( 'about-window' );
	},

	/**
	 * Shows preferences window.
	 */
	showPreferences( e )
	{
		if ( e )
		{
			e.stopPropagation();
		}

		// Create window dialog
		n.window( 'preferences-window' );

		// Remove colors of the button (mark messages as read)
		let trigger = document.getElementById( 'color-bulb' );

		trigger.classList.remove( 'nb-error' );
		trigger.classList.remove( 'nb-warn' );

		// Scroll console to the bottom for the user to see most recent messages first
		n.console.scrollTop = n.console.offsetHeight;
	},

	/**
	 * Shows Add files/folders window.
	 */
	showAddFileFolder()
	{
		n.window( 'add-window' );
	},

	/**
	 * Shows Load playlist window.
	 */
	showLoadPlaylist()
	{
		n.window( 'load-playlist-window' );
		document.getElementById( 'add-window-files' ).dataset.filter = 'plst.nsy';
	},

	/**
	 * Shows Load preferences window.
	 */
	showLoadPreferences()
	{
		n.window( 'load-preferences-window' );
		document.getElementById( 'add-window-files' ).dataset.filter = 'pref.nsy';
	},

	/**
	 * Shows Save playlist window.
	 */
	showSavePlaylist()
	{
		n.window( 'save-playlist-window' );
	},

	/**
	 * Shows Save preferences window.
	 */
	showSavePreferences()
	{
		n.window( 'save-preferences-window' );
	},

	/**
	 * Shows find window.
	 */
	showSearch( e )
	{
		if ( e )
		{
			e.stopPropagation();
		}

		n.window( 'find-window' );

		// Focus input element after CSS3 animation is over
		setTimeout( _ => document.getElementById( 'find-item' ).focus(), 300 );
	},

	/**
	 * Shows whats new window.
	 */
	showWhatsNew()
	{
		n.window( 'whats-new-window' );
	},

	/**
	 * Stop HTML Audio playback.
	 */
	stop()
	{
		// this === n if used with keyboard shortcut
		// When using keyboard shortcuts to stop the playback we do not have to fix button
		if ( this.dataset && this.dataset.originalAction )
		{
			n.toggleAlternate( this );
		}

		if ( n.activeItem )
		{
			let idx        = parseInt( n.audio.dataset.item, 10 );
			let playlistId = n.audio.dataset.playlist;
			let item;

			if ( 'number' === typeof idx && !isNaN( idx ) )
			{
				item = document.getElementById( playlistId ).querySelectorAll( '.playlist-item' )[ idx ];
				item.classList.remove( 'bold' );
			}

			// Pause player
			n.audio.pause();

			// Remove file from HTML Audio
			n.lastfm.scrobble();
			n.audio.src = '';

			// Remove data attributes
			delete n.audio.dataset.item;
			delete n.audio.dataset.playlist;

			// Set player state to stop
			n.setItemState();

			// Update player's gauges
			n.updateMeters();

			// Reset window title and footer to default
			n.setTitle( null, true );
			n.setFooter( null, true );

			// Clear counter
			document.getElementById( 'footer-counter' ).innerHTML = '';

			// Fix Play button to be Play
			document.getElementById( 'trigger-play' ).dataset.icon = 'x';
		}
	},

	/**
	 * Stops bubbling of an event.
	 * @param {Event} e Required. Event which should stop bubbling.
	 */
	stopBubbling( e )
	{
		e.stopPropagation();
	},

	/**
	 * Switch alternate action and icon of a button.
	 * @param {HTMLElement} button
	 * @param {Boolean} [alternate] Set menulistener and icon to alternate versions if true.
	 */
	toggleAlternate( button, alternate )
	{
		const dataset = button.dataset;
		let icon;
		let menulistener;

		if ( alternate )
		{
			// Save reference to be used for restoring the action and icon after alternate action finishes.
			dataset.originalIcon   = dataset.icon;
			dataset.originalAction = dataset.menulistener;

			// Show alternate action
			icon         = dataset.alternateIcon;
			menulistener = dataset.alternateAction;
		}
		else
		{
			icon         = dataset.originalIcon;
			menulistener = dataset.originalAction;

			delete dataset.originalIcon;
			delete dataset.originalAction;
		}

		dataset.icon         = icon;
		dataset.menulistener = menulistener;
	},

	/**
	 * Toggles mute state of the player.
	 */
	toggleMute()
	{
		n.pref.muted = !n.audio.muted;
	},

	/**
	 * Translate Noisy to the language set in the preferences.
	 */
	translate()
	{
		// Get selected language
		let lang = n.pref.lang;

		if ( n.langs[ lang ] )
		{
			n._translate();

			return Promise.resolve();
		}
		else
		{
			return fetch( `/js/i18n/${lang}.json?ver=${version}` ).then( response => response.json() ).then( json =>
			{
				// Cache the parsed theme if user wants to re-apply it
				n.langs[ lang ] = json;

				n._translate();

				return Promise.resolve();
			} );
		}
	},

	/**
	 * Updates battery meter and sets Noisy in power save mode
	 */
	updateBatteryStatus()
	{
		let batteryContainer = document.getElementById( 'battery-level-menu-handle' );
		let levels           = document.querySelectorAll( '.battery-level' );
		let level            = n.battery.level;
		let level1;
		let level2;
		let level3;
		let lvl;
		let threshold        = parseInt( document.getElementById( 'power-saver-state' ).value, 10 ) / 100;

		for ( let i = 0; i < levels.length; i++ )
		{
			lvl = levels[ i ];
			lvl.classList.remove( 'battery-level-green-full' );
			lvl.classList.remove( 'battery-level-green-half' );
			lvl.classList.remove( 'battery-level-orange-full' );
			lvl.classList.remove( 'battery-level-orange-half' );
			lvl.classList.remove( 'battery-level-red-full' );
			lvl.classList.remove( 'battery-level-red-half' );
		}

		if ( n.battery.level <= threshold && !n.battery.charging && n.pref.powerSaverEnabled )
		{
			if ( !n.powerSaveMode )
			{
				n.powerSaveMode = true;
				n.applyPowerSaveMode();
			}
		}
		else
		{
			if ( n.powerSaveMode )
			{
				n.powerSaveMode = false;
				n.applyPowerSaveMode();
			}
		}

		if ( !n.battery.charging && n.pref.powerSaverEnabled )
		{
			batteryContainer.setAttribute( 'title', `${Math.floor( n.battery.level * 100 )}%` );

			if ( 1 >= level && .83 <= level )
			{
				level1 = 'battery-level-green-full';
				level2 = 'battery-level-green-full';
				level3 = 'battery-level-green-full';
			}
			else if ( .82 >= level && .66 <= level )
			{
				level1 = 'battery-level-green-full';
				level2 = 'battery-level-green-full';
				level3 = 'battery-level-green-half';
			}
			else if ( .65 >= level && .50 <= level )
			{
				level1 = 'battery-level-orange-full';
				level2 = 'battery-level-orange-full';
			}
			else if ( .49 >= level && .33 <= level )
			{
				level1 = 'battery-level-orange-full';
				level2 = 'battery-level-orange-half';
			}
			else if ( .32 >= level && .16 <= level )
			{
				level1 = 'battery-level-red-full';
			}
			else
			{
				level1 = 'battery-level-red-half';
			}

			if ( level1 )
			{
				document.getElementById( 'battery-level-1' ).classList.add( level1 );
			}

			if ( level2 )
			{
				document.getElementById( 'battery-level-2' ).classList.add( level2 );
			}

			if ( level3 )
			{
				document.getElementById( 'battery-level-3' ).classList.add( level3 );
			}
		}
		else
		{
			batteryContainer.removeAttribute( 'title' );
		}
	},

	/**
	 * Updates playback counter in the status bar.
	 * @param {Number} dur Required. Length of the item in seconds.
	 * @param {Number} pos Required. Position of the playback in seconds.
	 */
	updateCounter( dur, pos )
	{
		document.getElementById( 'footer-counter' ).innerHTML = `${pos.toString().toHHMMSS()}/${dur.toString().toHHMMSS()}`;
	},

	/**
	 * Prints in the console that update has been downloaded and waiting for a refresh. Also marks Preferences icon
	 */
	updateFound()
	{
		n.console.innerHTML += `<div class="nb-update"><span class="update">${n.lang.console.update}</span></div>`;
		document.getElementById( 'color-bulb' ).classList.add( 'nb-update' );
	},

	/**
	 * Updates already rendered playlist item and adds passed tags to it
	 * @param {Object} tags Tags to add
	 * @param {HTMLElement|String|Number} item Item to update. If string or number is passed then the item will be
	 *     search by the passed value
	 * @param {String} [playlistId] Id of the playlist containing the item (if to be searched)
	 */
	updateItemTags( tags, item, playlistId = n.activePlaylistId )
	{
		// Get already rendered item
		item = item.tagName ? item : document.querySelector( `#${playlistId} .playlist-item[data-url="${item}"]` );

		// Add tags as data attributes
		Object.assign( item.dataset, tags );

		// Re-render the item
		n.renderItem( item );
	},

	/**
	 * Updates progress and volume meters on the GUI to be the same as HTML Audio.
	 */
	updateMeters()
	{
		if ( n.activeItem )
		{
			// If no duration, set to 1
			let dur      = n.audio.duration || 1;
			let pos      = n.audio.currentTime;
			let progress = Math.round( pos * 100 / dur );

			if ( 50 <= progress && !n.preloaded )
			{
				// Do not preload next time the updateMeters is called
				n.preloaded = true;

				let next = n.next( 'next', true );

				if ( next )
				{
					next.classList.add( 'preloaded' );
					n[ next.dataset.cloud ].preload( next );
				}
			}

			// Using animation frames to lower CPU usage when Noisy is not in focus
			requestAnimationFrame( _ =>
			{
				n.setProgress( document.getElementById( 'progress' ), progress );

				if ( n.pref.counter )
				{
					n.updateCounter( dur, pos );
				}
			} );

			// Update meters, by a recurtion, if the progress bar is not full
			if ( !n.audio.paused )
			{
				setTimeout( n.updateMeters, 1000 );
			}
		}
		else
		{
			n.setProgress( document.getElementById( 'progress' ), 0 );
		}
	},

	/**
	 * Changes numbers infront of the items that shows which after which will be played.
	 */
	updateQueueStates()
	{
		n.queue.forEach( ( item, i, queue ) =>
		{
			// Get item's number container
			let q = item.querySelector( '.item-queue' );

			// Set item's number container with the new value if not
			//already set (in case of the same item added more than once
			//in the queue) and it's not being processed in the playback at the moment.
			if ( i === queue.indexOf( item ) && !item.querySelector( '.playback-status' ).dataset.icon )
			{
				q.innerHTML = i + 1;
			}
		} );
	},

	/**
	 * Method called from n.lastfm to update the counter shown to the user in the Performance section
	 */
	updateScrobbleCounter()
	{
		document.getElementById( 'preference-performance-scrobbling-tracks-to-scrobble' ).innerText = `${n.lastfm.queue.q.size}/${n.lastfm.queue.maxSize}`;
	},

	/**
	 * Updates the volume bar and icon depending on the volume level and mute state
	 */
	updateVolumeState()
	{
		// Set volume icon to muted if Noisy is muted
		if ( n.pref.settings.muted )
		{
			n.setProgress( document.getElementById( 'volume' ), 0 );
			document.getElementById( 'trigger-mute' ).dataset.icon = '0';
		}
		// Otherwise set the progress bar as it'll set the appropriate icon, too
		else
		{
			n.setProgress( document.getElementById( 'volume' ), n.pref.settings.volume * 100 );
		}
	},

	/**
	 * Turns up the volume by 10%
	 */
	volumeUp()
	{
		n.pref.volume = Math.min( 1, n.audio.volume + 0.1 );
	},

	/**
	 * Turns down the volume by 10%
	 */
	volumeDown()
	{
		n.pref.volume = Math.max( 0, n.audio.volume - 0.1 );
	},

	/**
	 * Get the item being loaded
	 * @returns {HTMLElement}
	 */
	get waitingItem()
	{
		let item = document.getElementById( 'playlists' ).querySelector( 'div[data-icon="w"]' );

		if ( item )
		{
			item = item.parentNode.parentNode;
		}

		return item;
	},

	/**
	 * Adds a warning line to the console.
	 * @param {String} section Required. Contains property name in the
	 * language object for the action we are logging.
	 * @param {String} data Required. Text to be printed in the console.
	 */
	warn( section, data = '' )
	{
		n.console.innerHTML += `<div class="nb-warn"><span class="${section}">${n.lang.console[ section ]}</span>${data}</div>`;
		document.getElementById( 'color-bulb' ).classList.add( 'nb-warn' );
	},

	/**
	 * Shows window dialog.
	 * @param {String} cls Required. Class to be added to the window.
	 */
	window( cls )
	{
		// Get window element to which will apply classes
		let window = document.querySelector( '.window' );

		switch ( cls )
		{
			// These classes should be added to the window
			case 'exists':
				window.classList.remove( 'exists' );
				window.classList.add( cls );
				break;
			// All other classes are ids and should replace old id
			default:
				[ 'add-window', 'save-playlist-window', 'load-playlist-window', 'save-preferences-window', 'load-preferences-window' ].includes( cls ) && n.resetAddWindow();

				// Empty find window only when we are about to open it
				cls === 'find-window' && n.emptyFindWindow();

				window.id = cls;

				// Add blur
				document.getElementById( 'window-backdrop' ).classList.add( 'window-opened' );
		}
	}
};