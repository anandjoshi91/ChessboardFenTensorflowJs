// Turns a 256x256x[1,3] pixel image array containing 
// 32x32 chessboard tiles into a 64x1024 array, where 
// each row is one 32x32 tile rolled out.
function getTiles(img_256x256) {
  // TODO: This is a bit hacky, but we can reshape files properly so lets just reshape every
  // file(column) and concat them together.
  var files = []; // 8 columns.
  // Note: Uses first channel, since it assumes images are grayscale.
  for (var i = 0; i < 8; i++) {
    // Entire (32*8)x32 file of 8 tiles, reshaped into an  8x1024 array
    files[i] = img_256x256.slice([0,0+32*i,0],[32*8,32,1]).reshape([8,1024]); 
  }
  return tf.concat(files); // Concatanate all 8 8x1024 arrays into 64x1024 array.
}

function getLabeledPiecesAndFEN(predictions) {
  // Build 2D array with piece prediction label for each tile, matching the input 256x256 image.
  var pieces = [];
  for (var rank = 8 - 1; rank >= 0; rank--) {
    pieces[rank] = [];
    for (var file = 0; file < 8; file++) {
      // Convert integer prediction into labeled FEN notation.
      pieces[rank][file] = '1KQRBNPkqrbnp'[predictions[rank+file*8]]
    }
  }

  // Build FEN notation and HTML links for analysis and visualization.
  // Note: Does not contain castling information, lichess will automatically figure it out.
  var basic_fen = pieces.map(x => x.join('')).join('/')
    .replace(RegExp('11111111', 'g'), '8')
    .replace(RegExp('1111111', 'g'), '7')
    .replace(RegExp('111111', 'g'), '6')
    .replace(RegExp('11111', 'g'), '5')
    .replace(RegExp('1111', 'g'), '4')
    .replace(RegExp('111', 'g'), '3')
    .replace(RegExp('11', 'g'), '2');

  return {piece_array: pieces, fen:basic_fen};
}

// Globals element id's used: resultCanvas, fen
// Global variable used: predictor
function runPrediction(e) {
  console.log("Predicting on Input image...");
  const fen_element = document.getElementById('fen'); // NOTE - global id used here.
  const img = document.getElementById('resultCanvas'); // NOTE - global id used here.
  fen_element.innerHTML = "Model currently processing...";

  // Load pixels from aligned/bounded 256x256 px grayscale image canvas.
  const img_data = tf.fromPixels(img).asType('float32');

  // The image is loaded as a 256x256x3 pixel array, even though it's grayscale.
  // We just use the first channel since all should be the same.
  // Then, we need to properly reshape the array so that each 32x32 tile becomes a 1024 long row
  // in a [Nx1024] 2d tf array, where N = 64 for the 64 tiles.
  const tiles = getTiles(img_data);
  // Run model prediction on tiles.
  const output = predictor.execute({Input: tiles, KeepProb: tf.scalar(1.0)}); // NOTE - global used here.
  // Get model prediction.
  const raw_predictions = output.dataSync();
  // Get labeled piece array and basic FEN prediction.
  const chessboard = getLabeledPiecesAndFEN(raw_predictions);
  return chessboard;
}

// Update UI links and visualization.
function updateUI(chessboard) {
  // Lichess analysis link.
  const fen_element = document.getElementById('fen'); // NOTE - global id used here.
  const prediction_block = document.getElementById('prediction_block'); // NOTE - global id used here.
  const predict_visualization = document.getElementById('chessboard'); // NOTE - global id used here.

  // Used for when the board is inverted.
  var reversed_fen = chessboard.fen.split("").reverse().join("");
  
  // Raw fen text.
  fen_element.innerHTML = chessboard.fen;

  // Function to URL encode the FEN string with additional parameters
  function encodeQuickToolFEN(fen, side) {
    return encodeURIComponent(fen + " " + side + " KQkq - 0 1");
  }

  // Create URLs for onlinequicktool instead of lichess
  function makeQuickToolAnalysisURL(fen, side) {
    return "https://onlinequicktool.com/chess-next-move/?fen=" + encodeQuickToolFEN(fen, side);
  }

  // Keep the editor URL function for compatibility
  function makeLichessEditorURL(fen) {
    // Since onlinequicktool doesn't have a separate editor, use the same analysis URL
    return "https://onlinequicktool.com/chess-next-move/?fen=" + encodeURIComponent(fen);
  }

  function updateOQTUrl(id, str) {
    document.getElementById(id).href = str;
  }

  // Update the URLs to use onlinequicktool
  updateOQTUrl('lichess_analysis_white', makeQuickToolAnalysisURL(chessboard.fen, 'w'));
  updateOQTUrl('lichess_analysis_black', makeQuickToolAnalysisURL(chessboard.fen, 'b'));

  // Keep the editor links for compatibility
  updateOQTUrl('lichess_editor_white', makeQuickToolAnalysisURL(chessboard.fen, 'w'));
  updateOQTUrl('lichess_editor_black', makeQuickToolAnalysisURL(chessboard.fen, 'b'));

  // Update the inverted board URLs
  updateOQTUrl('oqt_analysis_white_inverted', makeQuickToolAnalysisURL(reversed_fen, 'w'));
  updateOQTUrl('oqt_analysis_black_inverted', makeQuickToolAnalysisURL(reversed_fen, 'b'));

  // Keep the inverted editor links for compatibility
  updateOQTUrl('oqt_editor_white_inverted', makeQuickToolAnalysisURL(reversed_fen, 'w'));
  updateOQTUrl('oqt_editor_black_inverted', makeQuickToolAnalysisURL(reversed_fen, 'b'));

  prediction_block.style.display = "block";

  // Generate chessboard div to visualize prediction.
  // TODO : Replace with import/export, currently assumes this function exists.
  rebuildChessboardDiv(predict_visualization, chessboard.fen);
}