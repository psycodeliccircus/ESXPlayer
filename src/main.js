// Módulos para controlar a vida útil do aplicativo e criar janela nativa do navegador
const fs = require('fs'),
  path = require('path'),
  { app, BrowserWindow, session, Menu, ipcMain, dialog, nativeImage } = require('electron'),
  Store = require('electron-store'),
  {
    ElectronBlocker,
    fullLists,
    Request
  } = require('@cliqz/adblocker-electron'),
  fetch = require('node-fetch');

const headerScript = fs.readFileSync(
  path.join(__dirname, 'client-header.js'),
  'utf8'
);

// Manipule a criação/remoção de atalhos no Windows ao instalar/desinstalar.
if (require('electron-squirrel-startup')) {
  // eslint-disable-line global-require
  app.quit();
}

// Criar variáveis globais
let mainWindow; // Objeto Global do Windows
const menu = require('./menu');
const store = new Store();
const log = require('log-to-file')
const { autoUpdater } = require('electron-updater');
const isUserDeveloper = require('electron-is-dev')
const { download } = require('electron-dl')
const log1 = require('electron-log')

const logDirectory = 'C:/Users/' + require("os").userInfo().username + '/AppData/Roaming/esxplayer/logs-esxplayer';

const getLogFile = () => {
  const filePath = path.join(logDirectory, 'esxplayer.log');

  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '');
  }
  return filePath;
};

app.setAppUserModelId("com.github.psycodeliccircus.esxplayer");

autoUpdater.setFeedURL({
  provider: "github",
  owner: "psycodeliccircus",
  releaseType: "release",
  repo: "ESXPlayer"
});

// Analytics endpoint
let defaultUserAgent;

async function createWindow() {
  log('Creating window', getLogFile())
  if (isUserDeveloper) {
    autoUpdater.checkForUpdates();
    log(isUserDeveloper, getLogFile());
  } else {
    autoUpdater.checkForUpdates();
    log("normal", getLogFile());
  }
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 580,
    icon: __dirname + "/build/icon.ico",
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      contextIsolation: false, // Deve ser desabilitado para script de pré-carregamento. Não estou ciente de uma solução alternativa, mas isso *não deve* afetar a segurança
      enableRemoteModule: true,
      plugins: true,
      preload: path.join(__dirname, 'client-preload.js')
    },

    

    // Estilo de janela
    transparent: true,
    vibrancy: 'ultra-dark',
    frame: store.get('options.pictureInPicture')
      ? false
      : !store.get('options.hideWindowFrame'),
    alwaysOnTop: store.get('options.alwaysOnTop'),
    toolbar: false,
    backgroundColor: '#00000000',
    fullscreen: store.get('options.launchFullscreen')
  });

  defaultUserAgent = mainWindow.webContents.userAgent;

  // Conecte o Adblocker à janela se ativado
  if (store.get('options.adblock')) {
    let engineCachePath = path.join(
      app.getPath('userData'),
      'adblock-engine-cache.txt'
    );

    if (fs.existsSync(engineCachePath)) {
      console.log('Cache do mecanismo Adblock encontrado. Carregando-o no aplicativo.');
      log('Cache do mecanismo Adblock encontrado. Carregando-o no aplicativo.', getLogFile())
      var engine = await ElectronBlocker.deserialize(
        fs.readFileSync(engineCachePath)
      );
    } else {
      var engine = await ElectronBlocker.fromLists(fetch, fullLists);
    }
    engine.enableBlockingInSession(session.defaultSession);

    // Cache do mecanismo de backup para disco
    fs.writeFile(engineCachePath, engine.serialize(), err => {
      if (err) throw err;
      console.log('O cache de arquivos do Adblock Engine foi atualizado!');
      log('O cache de arquivos do Adblock Engine foi atualizado!', getLogFile())
    });
  }

  // Redefinir o tamanho e a localização do Windows
  let windowDetails = store.get('options.windowDetails');
  let relaunchWindowDetails = store.get('relaunch.windowDetails');
  if (relaunchWindowDetails) {
    mainWindow.setSize(
      relaunchWindowDetails.size[0],
      relaunchWindowDetails.size[1]
    );
    mainWindow.setPosition(
      relaunchWindowDetails.position[0],
      relaunchWindowDetails.position[1]
    );
    store.delete('relaunch.windowDetails');
  } else if (windowDetails) {
    mainWindow.setSize(windowDetails.size[0], windowDetails.size[1]);
    mainWindow.setPosition(
      windowDetails.position[0],
      windowDetails.position[1]
    );
  }

  // Configurar imagem na imagem
  if (store.get('options.pictureInPicture') && process.platform === 'darwin') {
    app.dock.hide();
    mainWindow.setAlwaysOnTop(true, 'floating');
    mainWindow.setVisibleOnAllWorkspaces(true);
    mainWindow.setFullScreenable(false);
    app.dock.show();
  }

  // Detectar e atualizar a versão
  if (!store.get('version')) {
    store.set('version', app.getVersion());
    store.set('services', []);
    console.log('Configuração inicializada!');
    log('Configuração inicializada!', getLogFile())
  }

  // Carregue os serviços e mescle os usuários e serviços padrão
  let userServices = store.get('services') || [];
  global.services = userServices;

  require('./default-services').forEach(dservice => {
    let service = userServices.find(service => service.name == dservice.name);
    if (service) {
      global.services[userServices.indexOf(service)] = {
        name: service.name ? service.name : dservice.name,
        logo: service.logo ? service.logo : dservice.logo,
        url: service.url ? service.url : dservice.url,
        color: service.color ? service.color : dservice.color,
        style: service.style ? service.style : dservice.style,
        userAgent: service.userAgent ? service.userAgent : dservice.userAgent,
        permissions: service.permissions
          ? service.permissions
          : dservice.permissions,
        hidden: service.hidden != undefined ? service.hidden : dservice.hidden,
      };
    } else {
      dservice._defaultService = true;
      global.services.push(dservice);
    }
  });

  // Criar a barra de menus
  Menu.setApplicationMenu(menu(store, global.services, mainWindow, app, defaultUserAgent));

  // Carregar a interface do usuário ou o serviço padrão
  let defaultService = store.get('options.defaultService'),
    lastOpenedPage = store.get('options.lastOpenedPage'),
    relaunchToPage = store.get('relaunch.toPage');

  if (relaunchToPage !== undefined) {
    console.log('Reiniciar página ' + relaunchToPage);
    log(('Reiniciar página ' + relaunchToPage), getLogFile());
    mainWindow.loadURL(relaunchToPage);
    store.delete('relaunch.toPage');
  } else if (defaultService == 'lastOpenedPage' && lastOpenedPage) {
    console.log('Carregando a última página aberta ' + lastOpenedPage);
    log(('Carregando a última página aberta ' + lastOpenedPage), getLogFile())
    mainWindow.loadURL(lastOpenedPage);
  } else if (defaultService != undefined) {
    defaultService = global.services.find(
      service => service.name == defaultService
    );
    if (defaultService.url) {
      console.log('Carregando o serviço padrão ' + defaultService.url);
      log(('Carregando o serviço padrão ' + defaultService.url), getLogFile())
      mainWindow.loadURL(defaultService.url);
      mainWindow.webContents.userAgent = defaultService.userAgent ? defaultService.userAgent : defaultUserAgent;
    } else {
      console.log(
        "O serviço padrão de erro não tem um conjunto de URL. Voltando ao menu."
      );
      mainWindow.loadFile('src/ui/index.html');
    }
  } else {
    console.log('Carregando o menu principal');
    log('Carregando o menu principal', getLogFile())
    mainWindow.loadFile('src/ui/index.html');
  }

  // Emitido quando a janela está fechando
  mainWindow.on('close', e => {
    // Salvar serviço aberto se a última página aberta for o serviço padrão
    if (store.get('options.defaultService') == 'lastOpenedPage') {
      store.set('options.lastOpenedPage', mainWindow.getURL());
    }

    // Se ativado, armazene os detalhes da janela para que possam ser restaurados na reinicialização
    if (store.get('options.windowDetails')) {
      if (mainWindow) {
        store.set('options.windowDetails', {
          position: mainWindow.getPosition(),
          size: mainWindow.getSize()
        });
      } else {
        console.error(
          'A janela de erro não foi definida ao tentar salvar a janela Detalhes'
        );
        return;
      }
    }
  });

  // Injetar script de cabeçalho no carregamento da página se estiver na janela sem moldura
  mainWindow.webContents.on('dom-ready', broswerWindowDomReady);

  // Emitido quando a janela é fechada.
  mainWindow.on('closed', mainWindowClosed);

  // Emitido quando o site solicita permissões - o padrão Electron permite qualquer permissão que restringe sites
  mainWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      let websiteOrigin = new URL(webContents.getURL()).origin;
      let service = global.services.find(
        service => new URL(service.url).origin == websiteOrigin
      );

      if (
        (service &&
          service.permissions &&
          service.permissions.includes(permission)) ||
        permission == 'fullscreen'
      ) {
        console.log(
          `Allowed Requested Browser Permission '${permission}' For Site '${websiteOrigin}'`
        );
        return callback(true);
      }

      console.log(
        `Rejected Requested Browser Permission '${permission}' For Site '${websiteOrigin}'`
      );
      return callback(false);
    }
  );

  // Analytics
  // O Simple Analytics é usado para proteger a privacidade dos usuários. Esse rastreamento permite que os desenvolvedores construam
  // um produto melhor com mais informações sobre em quais dispositivos ele está sendo usado para que testes melhores possam ser feitos.
  let unique = false;
  if(!store.get('_do_not_edit___date_')) {
    store.set('_do_not_edit___date_', (new Date()).getTime())
    unique = true;
  } else {
    let now = new Date();
    let lastPing = new Date(new Date(store.get('_do_not_edit___date_')));
    if (lastPing.getFullYear() !== now.getFullYear() || lastPing.getMonth() !== now.getMonth() || lastPing.getDate() !== now.getDate()) {
      store.set('_do_not_edit___date_', now.getTime())
      unique = true;
    }
  }
}

// Este método é chamado quando o dom do Windows do navegador está pronto
// é usado para injetar o cabeçalho se o modo pictureInPicture e
// hideWindowFrame estão habilitados.
function broswerWindowDomReady() {
  if (
    store.get('options.pictureInPicture') ||
    store.get('options.hideWindowFrame')
  ) {
    // TODO: Esta é uma correção temporária e uma correção adequada deve ser desenvolvida
    if (mainWindow != null) {
      mainWindow.webContents.executeJavaScript(headerScript);
    }
  }
}

// Executar quando a janela estiver fechada. Isso limpa o objeto mainWindow para economizar recursos.
function mainWindowClosed() {
  mainWindow = null;
}

ipcMain.on('download-button', async (event, { url }) => {
  const mainWindow = BrowserWindow.getFocusedWindow();
  console.log(await download(mainWindow, url));
  log(await download(mainWindow, url), getLogFile())
});

// Este método será chamado quando o Electron terminar
// inicialização e está pronto para criar janelas do navegador.
// O tempo limite corrige o fundo transparente no Linux ???? Por quê
app.on('ready', () => setTimeout(createWindow, 500));

// Este é um evento personalizado que é usado para reiniciar o aplicativo.
// Ele destrói e recria a janela do navegador. Isso é usado para aplicar
// configurações que o Electron não permite que sejam alteradas em um ativo
// janela do navegador.
app.on('relaunch', () => {
  console.log('Reiniciando o aplicativo!');

  log('Reiniciando o aplicativo!', getLogFile())

  // Armazenar detalhes para lembrar quando reiniciado
  if (mainWindow.getURL() != '') {
    store.set('relaunch.toPage', mainWindow.getURL());
  }
  store.set('relaunch.windowDetails', {
    position: mainWindow.getPosition(),
    size: mainWindow.getSize()
  });

  // Destrua a janela do navegador
  mainWindow.webContents.removeListener('dom-ready', broswerWindowDomReady);

  // Remover App Close Listener
  mainWindow.removeListener('closed', mainWindowClosed);

  // Fechar aplicativo
  mainWindow.close();
  mainWindow = undefined;

  // Criar uma nova janela do navegador
  createWindow();
});

// Altere o URL do Windows quando solicitado pela interface do usuário
ipcMain.on('open-url', (e, service) => {
  console.log('Openning Service ' + service.name);
  log(('Openning Service ' + service.name), getLogFile())
  mainWindow.webContents.userAgent = service.userAgent ? service.userAgent : defaultUserAgent;
  mainWindow.loadURL(service.url);
});

// Desativar tela cheia quando o botão for pressionado
ipcMain.on('exit-fullscreen', e => {
  if (store.get('options.pictureInPicture')) {
    store.delete('options.pictureInPicture');
  } else if (store.get('options.hideWindowFrame')) {
    store.delete('options.hideWindowFrame');
  }

  // Relançar
  app.emit('relaunch');
});

// Saia quando todas as janelas estiverem fechadas.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS it's common to re-create a window in the app when the
// dock icon is clicked and there are no other windows open.
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

/* Restrict Electrons APIs In Renderer Process For Security */

function rejectEvent(event) {
  event.preventDefault();
}

const allowedGlobals = new Set(['services']);
app.on('remote-get-global', (event, webContents, globalName) => {
  if (!allowedGlobals.has(globalName)) {
    event.preventDefault();
  }
});
app.on('remote-require', rejectEvent);
app.on('remote-get-builtin', rejectEvent);
app.on('remote-get-current-window', rejectEvent);
app.on('remote-get-current-web-contents', rejectEvent);
app.on('remote-get-guest-web-contents', rejectEvent);

Object.defineProperty(app, 'isPackaged', {
  get() {
    return true;
  }
});

autoUpdater.on('checking-for-update', () => {
  log('Checking for updates.', getLogFile())
})

autoUpdater.on('update-available', info => {
  log('Update available.', getLogFile())
  dialog.showMessageBox({
    type: 'info',
    icon: nativeImage.createFromPath(path.join(__dirname, '..', 'build/icon.png')),
    message: `Uma nova versão ${info.version}, do ESXPlayer está disponível`,
    detail: 'A atualização será baixada em segundo plano. \nVocê será notificado quando estiver pronto para ser instalado.'
  });
})

autoUpdater.on('download-progress', (progressObj) => {
  log((`Downloading update. DL: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`), getLogFile())
})

autoUpdater.on('error', err => {
  log((`Update check failed: ${err.toString()}`), getLogFile())
})

autoUpdater.on('update-not-available', (event, releaseNotes, releaseName) => {
  dialog.showMessageBox({
    type: 'info',
    icon: nativeImage.createFromPath(path.join(__dirname, '..', 'build/icon.png')),
    message: 'Nenhuma atualização disponível',
    detail: `Você está executando a versão mais recente do \nESXPlayer Versão: ${app.getVersion()}`
  });
  log('Update not available. :)', getLogFile())
})


autoUpdater.on('update-downloaded', event => {
  log('A new version has been downloaded', getLogFile())
  // Ask user to update the app
  dialog.showMessageBox({
    type: 'question',
    buttons: ['Instalar e reiniciar', 'Instale depois'],
    defaultId: 0,
    message: `Uma nova atualização ${event.version} foi baixada`,
    detail: 'Ele será instalado e reiniciar o aplicativo'
  }, response => {
    if (response === 0) {
      setTimeout(() => {
        autoUpdater.quitAndInstall();
        // force app to quit. This is just a workaround, ideally autoUpdater.quitAndInstall() should relaunch the app.
        app.quit();
      }, 1000);
    }
  });
  setTimeout(() => {
    autoUpdater.quitAndInstall();
    // force app to quit. This is just a workaround, ideally autoUpdater.quitAndInstall() should relaunch the app.
    app.quit();
  }, 3000);
});