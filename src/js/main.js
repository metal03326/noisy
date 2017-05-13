/**
 * Starting point for Noisy.
 *
 * @author metal03326
 * @version 20170507
 */

'use strict';

/**
 * Time formatting needed for the duration of the items in the playlists.
 */
String.prototype.toHHMMSS = function()
{
	let time    = parseInt( this, 10 ),
	    hours   = ( '00' + Math.floor( time / 3600 ) ).substr( -2 ),
	    minutes = ( '00' + Math.floor( ( time - ( hours * 3600 ) ) / 60 ) ).substr( -2 ),
	    arr     = [
		    minutes,
		    ( '00' + ( time - ( hours * 3600 ) - ( minutes * 60 ) ) ).substr( -2 )
	    ];

	// Add the hours into the array if we have them
	if ( '00' !== hours )
	{
		arr.unshift( hours );
	}

	return arr.join( ':' );
};

let keyCodes = {
	8  : 'Backspace',
	9  : 'Tab',
	13 : 'Enter',
	16 : 'Shift',
	17 : 'Ctrl',
	18 : 'Alt',
	19 : 'Pause/Break',
	20 : 'Capslock',
	27 : 'Escape',
	32 : 'Space',
	33 : 'Page Up',
	34 : 'Page Down',
	35 : 'End',
	36 : 'Home',
	37 : 'Left',
	38 : 'Up',
	39 : 'Right',
	40 : 'Down',
	45 : 'Insert',
	46 : 'Delete',
	48 : '0',
	49 : '1',
	50 : '2',
	51 : '3',
	52 : '4',
	53 : '5',
	54 : '6',
	55 : '7',
	56 : '8',
	57 : '9',
	59 : ':',
	61 : '=',
	65 : 'A',
	66 : 'B',
	67 : 'C',
	68 : 'D',
	69 : 'E',
	70 : 'F',
	71 : 'G',
	72 : 'H',
	73 : 'I',
	74 : 'J',
	75 : 'K',
	76 : 'L',
	77 : 'M',
	78 : 'N',
	79 : 'O',
	80 : 'P',
	81 : 'Q',
	82 : 'R',
	83 : 'S',
	84 : 'T',
	85 : 'U',
	86 : 'V',
	87 : 'W',
	88 : 'X',
	89 : 'Y',
	90 : 'Z',
	91 : 'Win/Command',
	92 : 'Win/Command',
	93 : 'Select',
	96 : 'Num 0',
	97 : 'Num 1',
	98 : 'Num 2',
	99 : 'Num 3',
	100: 'Num 4',
	101: 'Num 5',
	102: 'Num 6',
	103: 'Num 7',
	104: 'Num 8',
	105: 'Num 9',
	106: '*',
	107: '+',
	109: '-',
	110: '.',
	111: '/',
	112: 'F1',
	113: 'F2',
	114: 'F3',
	115: 'F4',
	116: 'F5',
	117: 'F6',
	118: 'F7',
	119: 'F8',
	120: 'F9',
	121: 'F10',
	122: 'F11',
	123: 'F12',
	144: 'Num Lock',
	145: 'Scroll Lock',
	173: '-',
	186: ':',
	187: '=',
	188: ',',
	189: '-',
	190: '.',
	191: '/',
	192: '`',
	219: '[',
	220: '\\',
	221: ']',
	222: '\'',
	226: '|'
};

/**
 * Scroll item into the user's viewport if not already there.
 * @param {HTMLElement} el Required. Element which we need to scroll into view.
 */
//TODO: This function is not working as expected. Fix.
function scrollIntoViewIfOutOfView( el )
{
	let topOfPage    = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
	let heightOfPage = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
	let elY          = 0;

	for ( let p = el; p && p.tagName !== 'BODY'; p = p.offsetParent )
	{
		elY += p.offsetTop;
	}
	if ( ( topOfPage + heightOfPage ) < ( elY + el.offsetHeight ) )
	{
		el.scrollIntoView( false );
	}
	else if ( elY < topOfPage )
	{
		el.scrollIntoView( true );
	}
}

/**
 * Onload event handler.
 */
window.onload = () =>
{
	// Initialize Noisy
	n.init( () =>
	{
		// Remove the splash screen
		let splash = document.getElementById( 'splash' );

		// Timeouts are needed because we want to hide initial animations of the player
		setTimeout( () =>
		{
			splash.classList.add( 'visibility-hidden' );

			setTimeout( () =>
			{
				splash.parentNode.removeChild( splash );
				clearTimeout( window.splashTimeout );
				delete window.splashTimeout;
			}, 300 );
		}, 300 );
	} );
};

/**
 * Asyncronious loop.
 * @param {Number} iterations Required. How many iterations this loop will have.
 * @param {Function} fn Reguired. Function containing loop's body. Called each iteration.
 * @param {Function} callback Reguired. Function called when all iterations of the loop have finished.
 * @returns {Object} The loop object.
 */
function asyncLoop( iterations, fn, callback )
{
	let idx  = -1;
	let done = false;
	let loop = {
		get index()
		{
			return idx;
		},
		break()
		{
			idx = iterations;
			loop.next();
		},
		next()
		{
			if ( done )
			{
				return;
			}

			if ( idx < iterations )
			{
				idx++;
				fn( loop );

			}
			else
			{
				done = true;
				callback();
			}
		}
	};

	loop.next();

	return loop;
}