
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("bunyangCrmDesktop", {
  platform: process.platform,
  isDesktopApp: true,
});
