const fs       = require( 'fs-extra' );
const minifier = require( 'html-minifier' );
const CleanCSS = require( 'clean-css' );
const UglifyJS = require( 'uglify-js' );

let isProd                  = false;
let foldersToClean          = [ './docs/dev/' ];
let filesToCopyInDev        = [
	{ from: 'CHANGES.txt', to: './docs/dev/CHANGES.txt' },
	{ from: 'browserconfig.xml', to: './docs/dev/browserconfig.xml' },
	{ from: './docs/dev/img/open_graph.png', to: './docs/dev/open_graph.png', method: 'moveSync' },
	{ from: './docs/dev/img/favicon.ico', to: './docs/dev/favicon.ico', method: 'moveSync' }
];
let filesToCopyInProduction = [
	{ from: 'browserconfig.xml', to: './docs/browserconfig.xml' },
	{ from: 'CHANGES.txt', to: './docs/CHANGES.txt' },
	{ from: 'sitemap.xml', to: './docs/sitemap.xml' },
	{ from: 'robots.txt', to: './docs/robots.txt' },
	{ from: 'google9638db4c20f16281.html', to: './docs/google9638db4c20f16281.html' },
	{ from: './src/img/', to: './docs/img/' },
	{ from: './src/res/video.mp3', to: './docs/res/video.mp3' },
	{ from: './src/res/video.ogg', to: './docs/res/video.ogg' },
	{ from: './docs/img/open_graph.png', to: './docs/open_graph.png', method: 'moveSync' },
	{ from: './docs/img/favicon.ico', to: './docs/favicon.ico', method: 'moveSync' }
];

if ( process.argv.pop() !== 'dev' )
{
	isProd         = true;
	foldersToClean.push( './docs/' );
}

foldersToClean.forEach( fs.emptyDirSync );

if ( isProd )
{
	let data;
	let split;
	let parts;
	let indexHtml = '';

	data = minifier.minify( fs.readFileSync( './src/index.html', 'utf8' ), {
		removeComments              : true,
		removeCommentsFromCDATA     : true,
		removeCDATASectionsFromCDATA: true,
		collapseWhitespace          : true,
		collapseBooleanAttributes   : true,
		removeAttributeQuotes       : true,
		removeRedundantAttributes   : true,
		useShortDoctype             : true,
		removeEmptyAttributes       : true,
		removeOptionalTags          : true,
		minifyJS                    : true,
		minifyCSS                   : true
	} );

	// Find all the CSS files and replace them by their contents
	data.split( '<link ' ).forEach( part =>
	{
		parts   = part.split( '>' );
		let css = parts[ 0 ].split( '.css' );

		if ( css.length > 1 )
		{
			let name = css[ 0 ].split( 'href=' )[ 1 ] + '.css';

			console.log( 'Merging', name, 'into index.html' );
			indexHtml = indexHtml.substr( 0, indexHtml.length - 6 );
			indexHtml += '<style type="text/css">\n' + new CleanCSS().minify( fs.readFileSync( './src/' + name, 'utf8' ) ).styles + '\n\t\t</style>\n\t\t<link ';
		}
		else
		{
			indexHtml += parts.join( '>' ) + '<link ';
		}
	} );

	// Remove last <link
	indexHtml = indexHtml.substr( 0, indexHtml.length - 6 );

	// Get all the JS files and replace them with their contents
	split     = indexHtml.split( '<script ' );
	indexHtml = '';

	split.forEach( part =>
	{
		parts  = part.split( '>' );
		let js = parts[ 0 ].split( '.js' );

		if ( js.length > 1 )
		{
			let name = js[ 0 ].split( 'src=' )[ 1 ] + '.js';

			console.log( 'Merging', name, 'into index.html' );
			let toplevel = UglifyJS.parse( fs.readFileSync( './src/' + name, 'utf8' ) );
			toplevel.figure_out_scope();

			indexHtml = indexHtml.substr( 0, indexHtml.length - 8 );
			indexHtml += '<script type="text/javascript">\n' + toplevel.transform( UglifyJS.Compressor() ).print_to_string() + '\n';
			parts.shift();
		}

		indexHtml += parts.join( '>' ) + '<script ';
	} );

	// Remove last <script
	indexHtml = indexHtml.substr( 0, indexHtml.length - 8 );

	indexHtml = indexHtml.replace( /<\/script><script type="text\/javascript">/g, '' ).replace( /\n\n/g, '' ).replace( /"use strict"/g, '' ) + '</body></html>';

	console.log( 'Saving index.html to docs' );
	fs.writeFileSync( './docs/index.html', indexHtml );

	data = fs.readFileSync( './src/video.html', 'utf8' );
	data = minifier.minify( data, {
		removeComments              : true,
		removeCommentsFromCDATA     : true,
		removeCDATASectionsFromCDATA: true,
		collapseWhitespace          : true,
		collapseBooleanAttributes   : true,
		removeAttributeQuotes       : true,
		removeRedundantAttributes   : true,
		useShortDoctype             : true,
		removeEmptyAttributes       : true,
		removeOptionalTags          : true,
		minifyJS                    : true,
		minifyCSS                   : true
	} );

	console.log( 'Saving video.html to docs' );
	fs.writeFileSync( './docs/video.html', data );

	filesToCopyInProduction.forEach( file =>
	{
		let method = file.method || 'copySync';
		let from   = file.from || ( './src/' + file );
		let to     = file.to || ( './docs/' + file );

		console.log( method, from, 'to docs folder' );
		fs[ method ]( from, to );
	} );
}

// Copy all non processed files to the dev folder
console.log( '\nCopying ./src to ./docs/dev/' );
fs.copySync( './src/', './docs/dev/' );

filesToCopyInDev.forEach( file =>
{
	let method = file.method || 'copySync';
	let from   = file.from || ( './src/' + file );
	let to     = file.to || ( './docs/dev/' + file );

	console.log( method, from, 'to ./docs/dev/' );
	fs[ method ]( from, to );
} );