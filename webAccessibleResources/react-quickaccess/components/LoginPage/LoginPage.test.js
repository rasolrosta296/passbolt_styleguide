/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2022 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2022 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         3.10.0
 */

/**
 * Unit tests on LoginPage in regard of specifications
 */
import LoginPageTest from "./LoginPage.test.page";
import { defaultPropsWithSsoDisabled, defaultPropsWithSsoEnabled } from "./LoginPage.test.data";
import { waitFor } from "@testing-library/react";

beforeEach(() => {
  jest.resetModules();
});

describe("Quickaccess::LoginPage", () => {
  it(`As AN I can see the SSO login button by default from the quickacess if I have an SSO kit on my browser profile`, async () => {
    expect.assertions(1);

    const props = defaultPropsWithSsoEnabled();
    const page = new LoginPageTest(props);

    await page.isReady();

    expect(page.ssoLoginButton).toBeTruthy();
  });

  //covers as well `As AN when I sign in via passphrase when I don't have an SSO kit, an SSO kit is generated` as the kit is generated from the background page
  it(`As AN I can login via SSO from the quickacess`, async () => {
    expect.assertions(1);

    const props = defaultPropsWithSsoEnabled();
    const page = new LoginPageTest(props);

    await page.isReady();

    await page.clickOnSsoLoginButton();

    expect(props.ssoContext.runSignInProcess).toHaveBeenCalled();
  });

  it(`As AN I can still use the login via passphrase if I have an SSO kit on my browser profile`, async () => {
    expect.assertions(1);

    const props = defaultPropsWithSsoEnabled();
    const page = new LoginPageTest(props);

    await page.isReady();

    await page.clickOnSwitchToPassphraseForm();

    expect(page.passphraseInput).toBeTruthy();
  });

  it(`As AN when I am on the sign in with passphrase quickaccess page, I can switch to login via SSO if I have an SSO kit in my browser profile`, async () => {
    expect.assertions(2);

    const props = defaultPropsWithSsoEnabled();
    const page = new LoginPageTest(props);

    await page.isReady();

    await page.clickOnSwitchToPassphraseForm();

    expect(page.passphraseInput).toBeTruthy();

    await page.clickOnSwitchToSsoForm();

    expect(page.ssoLoginButton).toBeTruthy();
  });

  it(`As AN I cannot use the SSO login feature if I do not have an SSO kit on my browser profile`, async () => {
    expect.assertions(2);

    const props = defaultPropsWithSsoDisabled();
    const page = new LoginPageTest(props);

    await page.isReady();

    expect(page.passphraseInput).toBeTruthy();
    expect(page.switchToSsoFormButton).toBeFalsy();
  });

  it("uses local browser-profile enrollment status for logged-out Keycloak login", async () => {
    const props = defaultPropsWithSsoDisabled();
    props.context.siteSettings.isPluginEnabled = jest.fn((plugin) => plugin === "keycloakSso");
    const loginStatus = jest.fn(() => ({ enrolled: true }));
    const managementStatus = jest.fn(() => ({ linked: true, enrolled: true }));
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login.get-status", loginStatus);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enrollment.get-status", managementStatus);
    const page = new LoginPageTest(props);

    await page.isReady();

    expect(page.keycloakSsoLoginButton).toBeTruthy();
    expect(loginStatus).toHaveBeenCalledTimes(1);
    expect(managementStatus).not.toHaveBeenCalled();
  });

  it("hands native popup Keycloak login off without starting its cryptographic login transaction", async () => {
    const props = defaultPropsWithSsoDisabled();
    props.context.siteSettings.isPluginEnabled = jest.fn((plugin) => plugin === "keycloakSso");
    props.context.getDetached = jest.fn(() => false);
    props.context.setWindowBlurBehaviour = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login.get-status", () => ({
      enrolled: true,
    }));
    const openDetached = jest.fn();
    const login = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login.open-detached", openDetached);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login", login);
    const page = new LoginPageTest(props);

    await page.isReady();
    await page.clickOn(page.keycloakSsoLoginButton);

    expect(openDetached).toHaveBeenCalledTimes(1);
    expect(login).not.toHaveBeenCalled();
    expect(props.context.setWindowBlurBehaviour).not.toHaveBeenCalled();
    expect(props.context.closeWindow).toHaveBeenCalledTimes(1);
  });

  it("does not automatically start Keycloak cryptographic login when the detached login page mounts", async () => {
    const props = defaultPropsWithSsoDisabled();
    props.context.siteSettings.isPluginEnabled = jest.fn((plugin) => plugin === "keycloakSso");
    props.context.getDetached = jest.fn(() => true);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login.get-status", () => ({
      enrolled: true,
    }));
    const login = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login", login);
    const page = new LoginPageTest(props);

    await page.isReady();

    expect(page.keycloakSsoLoginButton).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it("cannot leave cryptographic login owned by a native popup that disconnects after handoff", async () => {
    const props = defaultPropsWithSsoDisabled();
    props.context.siteSettings.isPluginEnabled = jest.fn((plugin) => plugin === "keycloakSso");
    props.context.getDetached = jest.fn(() => false);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login.get-status", () => ({
      enrolled: true,
    }));
    const login = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login", login);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login.open-detached", () => {
      props.context.port.requestListeners = {};
    });
    const page = new LoginPageTest(props);

    await page.isReady();
    await page.clickOn(page.keycloakSsoLoginButton);

    expect(props.context.closeWindow).toHaveBeenCalledTimes(1);
    expect(login).not.toHaveBeenCalled();
  });

  it("signs in with a valid Keycloak browser-profile enrollment from detached Quick Access", async () => {
    const props = defaultPropsWithSsoDisabled();
    props.context.siteSettings.isPluginEnabled = jest.fn((plugin) => plugin === "keycloakSso");
    props.context.getDetached = jest.fn(() => true);
    props.context.setWindowBlurBehaviour = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login.get-status", () => ({
      enrolled: true,
    }));
    const login = jest.fn(() => undefined);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login", login);
    props.context.port.addRequestListener("passbolt.auth.is-mfa-required", () => false);
    props.loginSuccessCallback = jest.fn();
    const page = new LoginPageTest(props);

    await page.isReady();
    await page.clickOn(page.keycloakSsoLoginButton);

    await waitFor(() => expect(props.loginSuccessCallback).toHaveBeenCalledTimes(1));
    expect(login).toHaveBeenCalledTimes(1);
    expect(props.context.setWindowBlurBehaviour.mock.calls).toEqual([[false], [true]]);
  });

  it("does not render sensitive Keycloak login error details", async () => {
    const props = defaultPropsWithSsoDisabled();
    props.context.siteSettings.isPluginEnabled = jest.fn((plugin) => plugin === "keycloakSso");
    props.context.getDetached = jest.fn(() => true);
    props.context.setWindowBlurBehaviour = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login.get-status", () => ({
      enrolled: true,
    }));
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login", () => {
      throw new Error("id_token=secret-token&release_capability=secret-capability");
    });
    const page = new LoginPageTest(props);

    await page.isReady();
    await page.clickOn(page.keycloakSsoLoginButton);

    expect(page.ssoErrorMessage.textContent).toBe(
      "An error occured during the sign-in via SSO.Keycloak sign-in did not complete Passbolt cryptographic authentication. Sign in with your passphrase or try again.",
    );
    expect(page.ssoErrorMessage.textContent).not.toContain("secret-token");
    expect(page.ssoErrorMessage.textContent).not.toContain("secret-capability");
    expect(props.context.setWindowBlurBehaviour.mock.calls).toEqual([[false], [true]]);
  });

  it("keeps normal passphrase login unchanged when Keycloak login is available", async () => {
    const props = defaultPropsWithSsoDisabled();
    props.context.siteSettings.isPluginEnabled = jest.fn((plugin) => plugin === "keycloakSso");
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login.get-status", () => ({
      enrolled: true,
    }));
    const login = jest.fn(() => {
      throw new Error("Stop after normal login request.");
    });
    const openDetached = jest.fn();
    props.context.port.addRequestListener("passbolt.auth.login", login);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-login.open-detached", openDetached);
    props.context.port.addRequestListener("passbolt.remember-me.get-user-latest-choice", () => false);
    const page = new LoginPageTest(props);

    await page.isReady();
    await page.clickOnSwitchToPassphraseForm();
    await page.user.type(page.passphraseInput, "dummy-passphrase");
    await page.clickOn(page.select("button[type='submit']"));

    expect(login.mock.calls[0].slice(0, 2)).toEqual(["dummy-passphrase", false]);
    expect(openDetached).not.toHaveBeenCalled();
  });

  it(`As AN when I try to sign from the quickaccess via SSO, If I close the SSO login popup, the quickaccess should stay on the SSO form`, async () => {
    expect.assertions(1);

    const expectedError = new Error("The user closed the popup");
    expectedError.name = "UserAbortsOperationError";

    const props = defaultPropsWithSsoEnabled({
      ssoContext: {
        runSignInProcess: () => {
          throw expectedError;
        },
      },
    });
    const page = new LoginPageTest(props);

    await page.isReady();

    await page.clickOnSsoLoginButton();

    expect(page.passphraseInput).toBeFalsy();
  });

  it(`As AN when I attempt to sign in from the quickaccess via SSO and an error occurs after a successful SSO third party login, I can see an error message with the error details`, async () => {
    expect.assertions(1);

    const expectedError = new Error("The decrypted passphrase can't decrypt the user's private key");
    expectedError.name = "InvalidMasterPasswordError";

    const props = defaultPropsWithSsoEnabled({
      ssoContext: {
        runSignInProcess: () => {
          throw expectedError;
        },
      },
    });
    const page = new LoginPageTest(props);

    await page.isReady();

    await page.clickOnSsoLoginButton();

    expect(page.ssoErrorMessage.textContent).toBe(
      "An error occured during the sign-in via SSO.The decrypted passphrase can't decrypt the user's private key",
    );
  });

  it(`As AN when I attempt to sign in from the quickaccess via SSO and the API configuration changed, the quickaccess should close and I am redirected to the right tab`, async () => {
    expect.assertions(1);

    const expectedError = new Error("SSO Login can't proceed via quickaccess");
    expectedError.name = "SsoSettingsChangedError";

    const props = defaultPropsWithSsoEnabled({
      ssoContext: {
        runSignInProcess: () => {
          throw expectedError;
        },
      },
    });
    const page = new LoginPageTest(props);

    await page.isReady();

    await page.clickOnSsoLoginButton();

    expect(props.context.closeWindow).toHaveBeenCalledTimes(1);
  });
});
