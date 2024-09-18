import "./styles.css";

enum DeviceType {
  IOS = "IOS",
  ANDROID = "ANDROID",
  DESKTOP = "DESKTOP",
}

interface DeviceInfo {
  isStandAlone: boolean;
  canBeStandAlone: boolean;
  device: DeviceType;
}

function createDeviceInfo(
  isStandAlone: boolean,
  canBeStandAlone: boolean,
  device: DeviceType
): DeviceInfo {
  return { isStandAlone, canBeStandAlone, device };
}

interface ADHSBeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: ADHSBeforeInstallPromptEvent;
  }
}

interface AddToHomeScreenState {
  closeEventListener: EventListener | null;
  desktopInstallPromptEvent: ADHSBeforeInstallPromptEvent | null;
  desktopInstallPromptWasShown: boolean;
}

interface AddToHomeScreenType {
  isStandAlone: () => boolean;
  show: () => DeviceInfo;
  closeModal: () => void;
  shouldShowDesktopInstallPromptBasedOnDevice: () => boolean;
}

interface AddToHomeScreenConfig {
  appName: string;
  appIconUrl: string;
  assetUrl: string;
  maxModalDisplayCount: number;
}

function AddToHomeScreen(config: AddToHomeScreenConfig): AddToHomeScreenType {
  const { appIconUrl, appName, assetUrl, maxModalDisplayCount } = config;
  const state: AddToHomeScreenState = {
    closeEventListener: null,
    desktopInstallPromptEvent: null,
    desktopInstallPromptWasShown: false,
  };

  const win = window;
  const nav = win.navigator;
  const userAgent = nav.userAgent;

  if (shouldShowDesktopInstallPromptBasedOnDevice()) {
    _registerDesktopInstallPromptEvent();
  }

  function shouldShowDesktopInstallPromptBasedOnDevice(): boolean {
    return (
      !isStandAlone() &&
      !_hasReachedMaxModalDisplayCount() &&
      !isDeviceIOS() &&
      !isDeviceAndroid() &&
      (isDesktopChrome() || isDesktopEdge())
    );
  }

  function isStandAlone() {
    // test if web app is already installed to home screen
    return (
      !!("standalone" in nav && nav.standalone) || // IOS (TODO: detect iPad 13)
      win.matchMedia("(display-mode: standalone)").matches
    ); // Android and Desktop Chrome/Safari/Edge
  }

  function show(): DeviceInfo {
    var ret: DeviceInfo;

    var device: DeviceType;
    // var isStandAlone: boolean;
    // var canBeStandAlone: boolean;
    if (isDeviceIOS()) {
      device = DeviceType.IOS;
    } else if (isDeviceAndroid()) {
      device = DeviceType.ANDROID;
    } else {
      device = DeviceType.DESKTOP;
    }

    if (isStandAlone()) {
      debugMessage("ALREADY STANDALONE");

      ret = createDeviceInfo(true, true, device);
    } else if (_hasReachedMaxModalDisplayCount()) {
      ret = createDeviceInfo(false, false, device);
    } else if (isDeviceIOS() || isDeviceAndroid()) {
      debugMessage("NOT STANDALONE - IOS OR ANDROID");
      var shouldShowModal = true;
      _incrModalDisplayCount();
      var container = _createContainer(
        false // include_modal
      );

      if (isDeviceIOS()) {
        // ios
        if (isBrowserIOSSafari()) {
          ret = createDeviceInfo(false, true, device);

          _genIOSSafari(container);
        } else if (isBrowserIOSChrome()) {
          ret = createDeviceInfo(false, true, device);

          _genIOSChrome(container);
        } else if (isBrowserIOSInAppFacebook() || isBrowserIOSInAppLinkedin()) {
          ret = createDeviceInfo(false, false, device);

          _genIOSInAppBrowserOpenInSystemBrowser(container);
        } else if (
          isBrowserIOSInAppInstagram() ||
          isBrowserIOSInAppThreads() ||
          isBrowserIOSInAppTwitter()
        ) {
          ret = createDeviceInfo(false, false, device);

          _genIOSInAppBrowserOpenInSafariBrowser(container);
        } else {
          ret = createDeviceInfo(false, false, device);

          shouldShowModal = false;
        }
      } else {
        // android
        if (isBrowserAndroidChrome()) {
          ret = createDeviceInfo(false, true, device);

          _genAndroidChrome(container);
        } else if (isBrowserAndroidFacebook()) {
          ret = createDeviceInfo(false, false, device);
          _genIOSInAppBrowserOpenInSystemBrowser(container);
        } else {
          ret = createDeviceInfo(false, false, device);

          shouldShowModal = false;
        }
      }

      if (shouldShowModal) {
        _addContainerToBody(container);
      }
    } else {
      debugMessage("DESKTOP");
      ret = createDeviceInfo(false, false, device);

      if (isDesktopChrome() || isDesktopEdge()) {
        debugMessage("DESKTOP CHROME");
        showDesktopInstallPrompt();
      } else if (isDesktopSafari()) {
        debugMessage("DESKTOP SAFARI");
        _showDesktopSafariPrompt();
      }
    }

    return ret;
  }

  function closeModal() {
    // close the modal if the user clicks outside of the modal contents
    const container = document.querySelector(".adhs-container");
    if (container) {
      container.classList.remove("visible");
      setTimeout(() => {
        container.remove();
        if (state.closeEventListener) {
          win.removeEventListener("touchstart", state.closeEventListener);
          win.removeEventListener("click", state.closeEventListener);
          state.closeEventListener = null;
        }
      }, 300);
    }
  }

  /**** Internal Functions ****/

  function _getAppDisplayUrl(): string {
    // return 'https://aardvark.app';
    const currentUrl = new URL(win.location.href);
    return currentUrl.href.replace(/\/$/, "");
  }

  function _assertArg(variableName: string, booleanExp: boolean) {
    if (!booleanExp) {
      throw new Error(
        "AddToHomeScreen: variable '" + variableName + "' has an invalid value."
      );
    }
  }

  function _createContainer(include_modal = false) {
    const container = document.createElement("div");
    container.classList.add("adhs-container");

    if (include_modal) {
      var containerInnerHTML = _genLogo() + _genModalStart() + _genModalEnd();
      container.innerHTML = containerInnerHTML;
    }

    return container;
  }

  function _addContainerToBody(container: HTMLElement) {
    document.body.appendChild(container);
    _registerCloseListener();
    setTimeout(() => {
      container.classList.add("visible");
    }, 50);
  }

  function _genLogo() {
    return (
      `
      <div class="adhs-logo">
        <img src="` +
      appIconUrl +
      `" alt="logo" />
      </div>
      `
    );
  }

  // function _genTitleWithMessage(message: string) {
  //   return (
  //     `
  //     <div class="adhs-title">` +
  //     message +
  //     `</div>
  //     `
  //   );
  // }

  function _genModalStart() {
    return `<div class="` + _modalClassName() + `">`;
  }

  function _genModalEnd() {
    return `</div>`;
  }

  function _modalClassName() {
    return "adhs-modal";
  }

  function _genListStart() {
    return `<div class="adhs-list">`;
  }

  function _genListEnd() {
    return `</div>`;
  }

  function _genListItem(numberString: string, instructionHTML: string) {
    return (
      `
    <div class="adhs-list-item">
      <div class="adhs-number-container">
        <div class="adhs-circle">
          <div class="adhs-number">` +
      numberString +
      `</div>
        </div>
      </div>
      <div class="adhs-instruction">` +
      instructionHTML +
      `</div>
    </div>`
    );
  }

  function _genListButtonWithImage(
    imageUrl: string,
    text: string = "",
    image_side: string = "none"
  ) {
    if (!text) {
      return (
        `
      <div class="adhs-list-button">
          <img class="adhs-list-button-image-only" src="` +
        imageUrl +
        `" />
      </div>`
      );
    } else if (image_side === "right") {
      return (
        `
      <div class="adhs-list-button">
        <div class="adhs-list-button-text">` +
        text +
        `</div>
        <img class="adhs-list-button-image-right" src="` +
        imageUrl +
        `" />
      </div>`
      );
    } else if (image_side === "left") {
      return (
        `
      <div class="adhs-list-button">
        <img class="adhs-list-button-image-left" src="` +
        imageUrl +
        `" />
        <div class="adhs-list-button-text">` +
        text +
        `</div>
      </div>`
      );
    } else {
      throw new Error("_genListButtonWithImage: invalid arguments");
    }
  }

  function _genAssetUrl(fileName: string) {
    return assetUrl + fileName;
  }

  function _genIOSSafari(container: HTMLElement) {
    var containerInnerHTML =
      _genLogo() +
      _genModalStart() +
      _genInstallAppHeader() +
      // _genAppNameHeader() +
      // _genAppUrlHeader() +
      _genListStart() +
      _genListItem(
        `1`,

        `Tap the ${_genListButtonWithImage(
          _genAssetUrl("ios-safari-sharing-api-button-2.svg")
        )} button in the toolbar.`
      ) +
      _genListItem(
        `2`,
        `Select ${_genListButtonWithImage(
          _genAssetUrl("ios-safari-add-to-home-screen-button-2.svg"),
          "Add to Home Screen",
          "right"
        )} from the menu that pops up.` +
          ` <span class="adhs-emphasis">${"You may need to scroll down to find this menu item."}</span>`
      ) +
      // _genListItem(`3`, i18n.__('Open the %s app.', `<img class="adhs-your-app-icon" src="${appIconUrl}"/>`)) +
      _genListEnd() +
      _genBlurbMobile() +
      _genModalEnd() +
      `<div class="adhs-ios-safari-bouncing-arrow-container">
      <img src="` +
      _genAssetUrl("ios-safari-bouncing-arrow.svg") +
      `" alt="arrow" />
    </div>`;
    container.innerHTML = containerInnerHTML;
    container.classList.add("adhs-mobile", "adhs-ios", "adhs-safari");
  }

  function _genIOSChrome(container: HTMLElement) {
    var containerInnerHTML =
      _genLogo() +
      _genModalStart() +
      _genInstallAppHeader() +
      // _genAppNameHeader() +
      // _genAppUrlHeader() +
      _genListStart() +
      _genListItem(
        `1`,
        `Tap the ${_genListButtonWithImage(
          _genAssetUrl("ios-chrome-more-button-2.svg")
        )} button in the upper right corner.`
      ) +
      _genListItem(
        `2`,
        `Select ${_genListButtonWithImage(
          _genAssetUrl("ios-safari-add-to-home-screen-button-2.svg"),
          "Add to Home Screen",
          "right"
        )}} from the menu that pops up.` +
          ` ` +
          `<span class="adhs-emphasis">${"You may need to scroll down to find this menu item."}</span>`
      ) +
      // _genListItem(`3`, i18n.__('Open the %s app.', `<img class="adhs-your-app-icon" src="${appIconUrl}"/>`)) +
      _genListEnd() +
      _genBlurbMobile() +
      _genModalEnd() +
      `<div class="adhs-ios-chrome-bouncing-arrow-container">
      <img src="` +
      _genAssetUrl("ios-chrome-bouncing-arrow.svg") +
      `" alt="arrow" />
    </div>`;
    container.innerHTML = containerInnerHTML;
    container.classList.add("adhs-mobile", "adhs-ios", "adhs-chrome");
  }

  function _genIOSInAppBrowserOpenInSystemBrowser(container: HTMLElement) {
    var containerInnerHTML =
      _genLogo() +
      _genModalStart() +
      _genInstallAppHeader() +
      // _genAppNameHeader() +
      // _genAppUrlHeader() +
      _genListStart() +
      _genListItem(
        `1`,
        `Tap the ${`<img class="adhs-more-button" src="${_genAssetUrl(
          "generic-more-button.svg"
        )}"/>`} button above.`
      ) +
      _genListItem(
        `2`,
        `${"Tap"} <span class="adhs-emphasis">${"Open in browser"}</span>`
      ) +
      _genListEnd() +
      _genModalEnd() +
      `<div class="adhs-inappbrowser-openinsystembrowser-bouncing-arrow-container">
      <img src="` +
      _genAssetUrl("generic-vertical-up-bouncing-arrow.svg") +
      `" alt="arrow" />
    </div>`;
    container.innerHTML = containerInnerHTML;
    container.classList.add(
      "adhs-mobile",
      "adhs-ios",
      "adhs-inappbrowser-openinsystembrowser"
    );
  }

  function _genIOSInAppBrowserOpenInSafariBrowser(container: HTMLElement) {
    var containerInnerHTML =
      _genLogo() +
      _genModalStart() +
      _genInstallAppHeader() +
      // _genAppNameHeader() +
      // _genAppUrlHeader() +
      _genListStart() +
      _genListItem(
        `1`,
        `Tap the ${`<img class="adhs-more-button" src="${_genAssetUrl(
          "openinsafari-button.png"
        )}"/>`} button below to open your system browser.`
      ) +
      _genListEnd() +
      _genModalEnd() +
      `<div class="adhs-inappbrowser-openinsafari-bouncing-arrow-container">
      <img src="` +
      _genAssetUrl("generic-vertical-down-bouncing-arrow.svg") +
      `" alt="arrow" />
    </div>`;
    container.innerHTML = containerInnerHTML;
    container.classList.add(
      "adhs-mobile",
      "adhs-ios",
      "adhs-inappbrowser-openinsafari"
    );
  }

  function _genAndroidChrome(container: HTMLElement) {
    var containerInnerHTML =
      _genLogo() +
      _genModalStart() +
      _genInstallAppHeader() +
      // _genAppNameHeader() +
      // _genAppUrlHeader() +
      _genListStart() +
      _genListItem(
        `1`,
        `Tap ${_genListButtonWithImage(
          _genAssetUrl("android-chrome-more-button-2.svg")
        )} in the browser bar.`
      ) +
      _genListItem(
        `2`,
        `Tap ${_genListButtonWithImage(
          _genAssetUrl("android-chrome-add-to-home-screen-button-2.svg"),
          "Add to Home Screen",
          "left"
        )}`
      ) +
      // _genListItem(`3`, i18n.__('Open the %s app.', `<img class="adhs-your-app-icon" src="${appIconUrl}"/>`)) +
      _genListEnd() +
      _genBlurbMobile() +
      _genModalEnd() +
      `<div class="adhs-android-chrome-bouncing-arrow-container">
      <img src="` +
      _genAssetUrl("android-chrome-bouncing-arrow.svg") +
      `" alt="arrow" />
    </div>`;
    container.innerHTML = containerInnerHTML;
    container.classList.add("adhs-mobile", "adhs-android", "adhs-chrome");
  }

  function _genInstallAppHeader() {
    return `<h1 class="adhs-install-app">` + "Install " + appName + `</h1>`;
  }

  // function _genAppNameHeader() {
  //   return "";
  //   // return `<div class="adhs-app-name">` + appName + `</div>`;
  // }

  function _genAppUrlHeader() {
    return `<div class="adhs-app-url">` + _getAppDisplayUrl() + `</div>`;
  }

  function _genBlurbWithMessage(message: string) {
    return `<div class="adhs-blurb">` + message + `</div>`;
  }

  function _genBlurbMobile() {
    return _genBlurbWithMessage(
      "An icon will be added to your home screen so you can quickly access this website."
    );
  }

  function _genBlurbDesktopWindows() {
    return _genBlurbWithMessage(
      "An icon will be added to your Taskbar so you can quickly access this website."
    );
  }

  function _genBlurbDesktopMac() {
    return _genBlurbWithMessage(
      "An icon will be added to your Dock so you can quickly access this website."
    );
  }

  function _genDesktopChrome(container: HTMLElement) {
    var blurb: string = isDesktopMac()
      ? _genBlurbDesktopMac()
      : _genBlurbDesktopWindows();

    var containerInnerHTML =
      _genLogo() +
      _genModalStart() +
      _genInstallAppHeader() +
      // _genAppNameHeader() +
      _genAppUrlHeader() +
      blurb +
      `<div class="adhs-button-container">
      <button class="adhs-button adhs-button-cancel">
        ` +
      "Later" +
      `
      </button>
      <button class="adhs-button adhs-button-install">
        ` +
      "Install" +
      `
      </button>
    </div>` +
      _genModalEnd();

    container.innerHTML = containerInnerHTML;
    container.classList.add("adhs-desktop", "adhs-desktop-chrome");

    var cancelButton =
      container.getElementsByClassName("adhs-button-cancel")[0];
    cancelButton.addEventListener("click", () => {
      closeModal();
    });

    var installButton = container.getElementsByClassName(
      "adhs-button-install"
    )[0];
    installButton.addEventListener("click", () => {
      if (!_desktopInstallPromptEvent) {
        return;
      }
      _desktopInstallPromptEvent.prompt();
      closeModal();

      _desktopInstallPromptEvent.userChoice.then(
        (choiceResult: { outcome: string }) => {
          if (choiceResult.outcome === "accepted") {
            debugMessage("User accepted the install prompt");
          } else {
            debugMessage("User dismissed the install prompt");
          }
          _desktopInstallPromptEvent = null;
        }
      );
    });
  }

  function _genDesktopSafari(container: HTMLElement) {
    var blurb: string = isDesktopMac()
      ? _genBlurbDesktopMac()
      : _genBlurbDesktopWindows();

    var containerInnerHTML =
      _genLogo() +
      _genModalStart() +
      _genInstallAppHeader() +
      // _genAppNameHeader() +
      _genAppUrlHeader() +
      _genListStart() +
      _genListItem(
        `1`,
        `Tap ${_genListButtonWithImage(
          _genAssetUrl("desktop-safari-menu.svg")
        )} in the toolbar.`
      ) +
      _genListItem(
        `2`,
        `Tap ${_genListButtonWithImage(
          _genAssetUrl("desktop-safari-dock.svg"),
          "Add To Dock",
          "left"
        )}`
      ) +
      _genListEnd() +
      blurb +
      _genModalEnd() +
      `<div class="adhs-desktop-safari-bouncing-arrow-container">
      <img src="` +
      _genAssetUrl("desktop-safari-bouncing-arrow.svg") +
      `" alt="arrow" />
    </div>`;
    container.innerHTML = containerInnerHTML;

    container.classList.add("adhs-desktop", "adhs-desktop-safari");
  }

  function _registerCloseListener() {
    state.closeEventListener = (e: Event) => {
      var modal = document
        .getElementsByClassName("adhs-container")[0]
        .getElementsByClassName("adhs-modal")[0];
      if (!modal.contains(e.target as Node)) {
        closeModal();
      }
    };

    // enclose in setTimeout to prevent firing when this class used with an onclick
    setTimeout(() => {
      win.addEventListener("touchstart", state.closeEventListener!);
      win.addEventListener("click", state.closeEventListener!);
    }, 50);
  }

  // function clearModalDisplayCount() {
  //   if (_isEnabledModalDisplayCount()) {
  //     win.localStorage.removeItem(_getModalDisplayCountKey());
  //   }
  // }

  function _isEnabledModalDisplayCount(): boolean {
    return (
      typeof maxModalDisplayCount === "number" &&
      maxModalDisplayCount >= 0 &&
      win.localStorage !== undefined
    );
  }

  function _hasReachedMaxModalDisplayCount(): boolean {
    if (!_isEnabledModalDisplayCount()) {
      return false;
    }
    return _getModalDisplayCount() >= maxModalDisplayCount;
  }

  function _incrModalDisplayCount(): boolean {
    if (!_isEnabledModalDisplayCount()) {
      return false;
    }

    var count: number = _getModalDisplayCount();
    count++;
    win.localStorage.setItem(_getModalDisplayCountKey(), count.toString());
    return true;
  }

  function _getModalDisplayCountKey(): string {
    return "adhs-modal-display-count";
  }

  function _getModalDisplayCount(): number {
    var countStr: string | null = win.localStorage.getItem(
      _getModalDisplayCountKey()
    );
    var count: number;
    if (countStr === null) {
      count = 0;
      win.localStorage.setItem(_getModalDisplayCountKey(), count.toString());
    } else {
      count = parseInt(countStr);
    }
    return count;
  }

  function debugMessage(message: string) {
    // alert(message);
    // console.log(message);
  }

  let _desktopInstallPromptEvent: ADHSBeforeInstallPromptEvent | null = null;
  let _desktopInstallPromptWasShown: boolean = false;

  function _registerDesktopInstallPromptEvent() {
    win.addEventListener(
      "beforeinstallprompt",
      _desktopInstallPromptEventListener
    );
  }

  const _desktopInstallPromptEventListener = (
    e: ADHSBeforeInstallPromptEvent
  ) => {
    debugMessage("DESKTOP CHROME LISTENER");
    e.preventDefault();
    _desktopInstallPromptEvent = e;
  };

  function _desktopInstallPromptEventHasFired(): boolean {
    return _desktopInstallPromptEvent !== null;
  }

  // show the desktop chrome promotion
  function showDesktopInstallPrompt() {
    debugMessage("SHOW DESKTOP CHROME / EDGE PROMOTION");

    if (_desktopInstallPromptWasShown) {
      return;
    }

    // if the prompt has not fired, wait for it the be fired, then show the promotion
    if (!_desktopInstallPromptEventHasFired()) {
      // debugMessage("SHOW DESKTOP CHROME PROMOTION: PROMPT NOT FIRED");
      setTimeout(() => {
        showDesktopInstallPrompt();
      }, 500);
      return;
    }

    // debugMessage("SHOW DESKTOP CHROME PROMOTION: PROMPT FIRED");

    _desktopInstallPromptWasShown = true;

    const container = _createContainer(
      true // include_modal
    );

    _genDesktopChrome(container);
    _addContainerToBody(container);
  }

  function _showDesktopSafariPrompt() {
    debugMessage("SHOW SAFARI DESKTOP PROMPT");
    var container = _createContainer(
      true // include_modal
    );
    _genDesktopSafari(container);
    _addContainerToBody(container);
  }

  function isBrowserIOSSafari() {
    return (
      isDeviceIOS() &&
      nav.userAgent.match(/Safari/) &&
      !isBrowserIOSChrome() &&
      !isBrowserIOSFirefox() &&
      !isBrowserIOSInAppFacebook() &&
      !isBrowserIOSInAppLinkedin() &&
      !isBrowserIOSInAppInstagram() &&
      !isBrowserIOSInAppThreads() &&
      !isBrowserIOSInAppTwitter()
    );
  }
  function isDeviceIOS(): boolean {
    return !!userAgent.match(/iPhone|iPad|iPod/);
  }

  function isDeviceAndroid() {
    return userAgent.match(/Android/);
  }

  function isBrowserIOSChrome() {
    return isDeviceIOS() && userAgent.match(/CriOS/);
  }

  /* Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) 
AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/114.1 Mobile/15E148 Safari/605.1.15 */
  function isBrowserIOSFirefox() {
    return isDeviceIOS() && userAgent.match(/FxiOS/);
  }

  function isBrowserIOSInAppFacebook() {
    if (!isDeviceIOS()) {
      return false;
    }

    return userAgent.match(/FBAN|FBAV/);
  }

  function isBrowserIOSInAppLinkedin() {
    if (!isDeviceIOS()) {
      return false;
    }

    return userAgent.match(/LinkedInApp/);
  }

  function isBrowserIOSInAppInstagram() {
    if (!isDeviceIOS()) {
      return false;
    }

    // TODO: this is incompatible with Instagram/Threads mobile website links.
    // TODO: this solution only works with first-level links
    if (win.document.referrer.match("//l.instagram.com/")) {
      return true;
    }

    return false;
  }

  function isBrowserIOSInAppThreads() {
    return isBrowserIOSInAppInstagram();
  }

  function isBrowserIOSInAppTwitter() {
    if (!isDeviceIOS()) {
      return false;
    }

    // TODO: this solution is incompatible with Twitter mobile website links
    // TODO: this solution only works with first-level links
    return win.document.referrer.match("//t.co/");
  }

  /* Mozilla/5.0 (Linux; Android 10) 
   AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.92 Mobile Safari/537.36 */
  function isBrowserAndroidChrome() {
    return (
      isDeviceAndroid() &&
      userAgent.match(/Chrome/) &&
      !isBrowserAndroidFacebook() &&
      !isBrowserAndroidSamsung() &&
      !isBrowserAndroidFirefox()
    );
  }

  /*Mozilla/5.0 (Linux; Android 12; SM-S908U1 Build/SP1A.210812.016; wv) 
  AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.88 
  Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/377.0.0.22.107;]*/
  function isBrowserAndroidFacebook() {
    return isDeviceAndroid() && userAgent.match(/FBAN|FBAV/);
  }

  /* Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 
(KHTML, like Gecko) SamsungBrowser/21.0 Chrome/110.0.5481.154 Mobile Safari/537.36 */
  function isBrowserAndroidSamsung() {
    return isDeviceAndroid() && userAgent.match(/SamsungBrowser/);
  }

  /* Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/114.0 Firefox/114.0 */
  function isBrowserAndroidFirefox() {
    return isDeviceAndroid() && userAgent.match(/Firefox/);
  }

  // function isDesktopWindows() {
  //   return userAgent.includes("Windows");
  // }

  function isDesktopMac() {
    return userAgent.includes("Macintosh");
  }

  function isDesktopChrome() {
    const isChrome = userAgent.includes("Chrome") && !userAgent.includes("Edg"); // Exclude Edge browser
    const isDesktop =
      userAgent.includes("Windows") ||
      userAgent.includes("Macintosh") ||
      userAgent.includes("Linux");

    return isChrome && isDesktop;
  }

  function isDesktopSafari() {
    const isSafari =
      userAgent.includes("Safari") &&
      !userAgent.includes("Chrome") &&
      !userAgent.includes("Edg");
    const isDesktop =
      userAgent.includes("Macintosh") || userAgent.includes("Windows");

    return isSafari && isDesktop;
  }

  function isDesktopEdge() {
    return userAgent.includes("Edg/");
  }

  return {
    closeModal,
    isStandAlone,
    shouldShowDesktopInstallPromptBasedOnDevice,
    show,
  };
}

export default AddToHomeScreen;
