// voice.js
export function startListening() {
  // Check if the browser supports SpeechRecognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Your browser does not support speech recognition. Please try a different browser.');
    return;
  }

  // Create a new SpeechRecognition object
  const recognition = new SpeechRecognition();

  // Start listening for voice input
  recognition.start();

  // Handle the result of the recognition
  recognition.onresult = function(event) {
    const transcript = event.results[0][0].transcript;
    console.log('You said: ' + transcript);
  };

  // Handle any errors
  recognition.onerror = function(event) {
    console.error('Speech recognition error:', event.error);
  };
}