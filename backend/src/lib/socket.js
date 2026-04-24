let ioRef = null;

function setIo(io) {
  ioRef = io;
}

function getIo() {
  return ioRef;
}

function emitEvent(event, payload) {
  if (ioRef) {
    ioRef.emit(event, payload);
  }
}

module.exports = { setIo, getIo, emitEvent };
