const { app, BrowserWindow } = require('electron');
const { startApp } = require('./server');

let mainWindow;

async function createWindow() {
  // Start the Express server and get the port
  const port = await startApp();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    title: "PDF Summary",
    webPreferences: {
      nodeIntegration: false, // Security: Keep false for loading remote/local content
      contextIsolation: true
    }
  });

  // Load the app running on localhost
  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});