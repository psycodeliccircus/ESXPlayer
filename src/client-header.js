/* This is injecting into remote webpages to add a
menubar which can be used to move the window around
and exit from frameless window on linux which were
the frameless window hides the settings menu.
*/

console.log('ESXPlayer: Injected Header');

document.body.insertAdjacentHTML(
  'beforeend',
  `
    <div class="ESXPlayer-topbar"></div>
    <span class="ESXPlayer-exit-btn" onclick="ipc.send('exit-fullscreen')">&times;</span>
    <style>
        .ESXPlayer-topbar {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 13px;
          opacity: 0;
          background: black;
          z-index: 99999;
          cursor: -webkit-grab;
          cursor: grab;
          -webkit-user-drag: none;
          -webkit-app-region: drag;
        }

        .ESXPlayer-topbar:hover {
          opacity: 1;
        }

        .ESXPlayer-exit-btn {
          position: fixed;
          top: 0;
          left: 0;
          color: rgba(255, 255, 255, 0.15);;
          font-size: 40px;
          font-weight: 600;
          padding-left: 5px;
          z-index: 99999;
          cursor: -webkit-grab;
          cursor: grab;
          -webkit-user-drag: none;
          -webkit-app-region: no-drag;
        }

        .ESXPlayer-exit-btn:hover {
          color: white;
        }

        ::-webkit-scrollbar {
          display: none;
        }
    </style>
`
);
