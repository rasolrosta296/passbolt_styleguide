import React from "react";
import { MemoryRouter as Router } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockTranslationProvider from "../../../react-extension/test/mock/components/Internationalisation/MockTranslationProvider";
import { defaultAppContext } from "../../contexts/AppContext.test.data";
import KeycloakSsoPage from "./KeycloakSsoPage";

function propsWithStatus(enrolled, detached = true, linked = true) {
  const context = defaultAppContext();
  context.siteSettings.isPluginEnabled = jest.fn((plugin) => plugin === "keycloakSso");
  context.port.addRequestListener("passbolt.keycloak-sso.crypto-enrollment.get-status", () => ({ linked, enrolled }));
  context.getDetached = jest.fn(() => detached);
  context.setWindowBlurBehaviour = jest.fn();
  return { context };
}

function renderPage(props) {
  return render(
    <MockTranslationProvider>
      <Router>
        <KeycloakSsoPage {...props} />
      </Router>
    </MockTranslationProvider>,
  );
}

describe("Quickaccess::KeycloakSsoPage", () => {
  it("shows the authenticated Keycloak SSO management title", async () => {
    renderPage(propsWithStatus(true));

    expect(await screen.findByText("Keycloak SSO")).toBeTruthy();
    expect(screen.queryByText("Keycloak sign-in")).toBeNull();
  });

  it("requires identity linking before browser-profile enrollment", async () => {
    const props = propsWithStatus(false, true, false);
    const startLink = jest.fn();
    const startEnrollment = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.identity.link", startLink);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enroll.start", startEnrollment);

    renderPage(props);

    expect(await screen.findByText("Your Keycloak identity is not linked.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Link Keycloak identity" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Authenticate with Keycloak to enroll" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unlink Keycloak" })).toBeNull();
    expect(startLink).not.toHaveBeenCalled();
    expect(startEnrollment).not.toHaveBeenCalled();
  });

  it("allows a linked identity to be unlinked before browser-profile enrollment", async () => {
    renderPage(propsWithStatus(false, true, true));

    expect(await screen.findByRole("button", { name: "Authenticate with Keycloak to enroll" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unlink Keycloak" })).toBeTruthy();
  });

  it("hands native popup identity linking off without starting the link flow", async () => {
    const props = propsWithStatus(false, false, false);
    const user = userEvent.setup();
    const openDetached = jest.fn();
    const startLink = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.identity.link.open-detached", openDetached);
    props.context.port.addRequestListener("passbolt.keycloak-sso.identity.link", startLink);

    renderPage(props);
    await user.click(await screen.findByRole("button", { name: "Link Keycloak identity" }));

    await waitFor(() => expect(openDetached).toHaveBeenCalledTimes(1));
    expect(startLink).not.toHaveBeenCalled();
    expect(props.context.closeWindow).toHaveBeenCalledTimes(1);
  });

  it("links only after an explicit click in detached Quick Access", async () => {
    const props = propsWithStatus(false, true, false);
    const user = userEvent.setup();
    const startLink = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.identity.link", startLink);

    renderPage(props);
    expect(await screen.findByRole("button", { name: "Link Keycloak identity" })).toBeTruthy();
    expect(startLink).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Link Keycloak identity" }));

    await waitFor(() => expect(startLink).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Authenticate with Keycloak to enroll" })).toBeTruthy();
    expect(screen.getByText("Your Keycloak identity is linked. You can now enroll this browser profile.")).toBeTruthy();
    expect(props.context.setWindowBlurBehaviour.mock.calls).toEqual([[false], [true]]);
  });

  it("recovers the authoritative linked state after a duplicate-link collision", async () => {
    const props = propsWithStatus(false, true, false);
    const user = userEvent.setup();
    let statusRequests = 0;
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enrollment.get-status", () => {
      statusRequests += 1;
      return statusRequests === 1 ? { linked: false, enrolled: false } : { linked: true, enrolled: true };
    });
    props.context.port.addRequestListener("passbolt.keycloak-sso.identity.link", () => {
      throw new Error("Identity collision");
    });

    renderPage(props);
    await user.click(await screen.findByRole("button", { name: "Link Keycloak identity" }));

    expect(await screen.findByText("Your Keycloak identity is already linked to this Passbolt account.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unlink Keycloak" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(statusRequests).toBe(2);
  });

  it("hands native popup enrollment off without starting its OIDC transaction", async () => {
    const props = propsWithStatus(false, false);
    const user = userEvent.setup();
    const openDetached = jest.fn();
    const startEnrollment = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enroll.open-detached", openDetached);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enroll.start", startEnrollment);

    renderPage(props);
    await user.click(await screen.findByRole("button", { name: "Authenticate with Keycloak to enroll" }));

    await waitFor(() => expect(openDetached).toHaveBeenCalledTimes(1));
    expect(startEnrollment).not.toHaveBeenCalled();
    expect(props.context.setWindowBlurBehaviour).not.toHaveBeenCalled();
    expect(props.context.closeWindow).toHaveBeenCalledTimes(1);
  });

  it("does not start enrollment automatically when the detached page mounts", async () => {
    const props = propsWithStatus(false, true);
    const startEnrollment = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enroll.start", startEnrollment);

    renderPage(props);

    expect(await screen.findByRole("button", { name: "Authenticate with Keycloak to enroll" })).toBeTruthy();
    expect(startEnrollment).not.toHaveBeenCalled();
  });

  it("starts enrollment only in detached Quick Access and restores blur-close behavior", async () => {
    const props = propsWithStatus(false, true);
    const user = userEvent.setup();
    const metadata = { enrollment_id: "10000000-0000-4000-8000-000000000001" };
    const startEnrollment = jest.fn(() => metadata);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enroll.start", startEnrollment);

    renderPage(props);
    await user.click(await screen.findByRole("button", { name: "Authenticate with Keycloak to enroll" }));

    await screen.findByLabelText("Passphrase");
    expect(startEnrollment).toHaveBeenCalledTimes(1);
    expect(props.context.setWindowBlurBehaviour.mock.calls).toEqual([[false], [true]]);
    expect(props.context.closeWindow).not.toHaveBeenCalled();
  });

  it("cannot leave enrollment owned by a native popup that disconnects after handoff", async () => {
    const props = propsWithStatus(false, false);
    const user = userEvent.setup();
    const startEnrollment = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enroll.start", startEnrollment);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enroll.open-detached", () => {
      props.context.port.requestListeners = {};
    });

    renderPage(props);
    await user.click(await screen.findByRole("button", { name: "Authenticate with Keycloak to enroll" }));

    await waitFor(() => expect(props.context.closeWindow).toHaveBeenCalledTimes(1));
    expect(startEnrollment).not.toHaveBeenCalled();
  });

  it("keeps the native popup open and does not start enrollment when detached handoff fails", async () => {
    const props = propsWithStatus(false, false);
    const user = userEvent.setup();
    const startEnrollment = jest.fn();
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enroll.start", startEnrollment);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enroll.open-detached", () => {
      throw new Error("Window creation failed");
    });

    renderPage(props);
    await user.click(await screen.findByRole("button", { name: "Authenticate with Keycloak to enroll" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Keycloak authentication could not be completed. Try again to start a fresh enrollment.",
    );
    expect(startEnrollment).not.toHaveBeenCalled();
    expect(props.context.closeWindow).not.toHaveBeenCalled();
  });

  it("collects the passphrase only after fresh Keycloak authentication", async () => {
    const props = propsWithStatus(false);
    const user = userEvent.setup();
    const metadata = {
      enrollment_id: "10000000-0000-4000-8000-000000000001",
      identity_id: "20000000-0000-4000-8000-000000000002",
      protocol_version: "passbolt-keycloak-sso-v1",
      crypto_suite: "AES-256-GCM+HPKE-P256-HKDF-SHA256-AES128GCM",
    };
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enroll.start", () => metadata);
    const complete = jest.fn(() => ({ enrollment_id: metadata.enrollment_id }));
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enroll.complete", complete);

    renderPage(props);
    await user.click(await screen.findByRole("button", { name: "Authenticate with Keycloak to enroll" }));
    const input = await screen.findByLabelText("Passphrase");
    expect(input.value).toBe("");

    await user.type(input, "dummy-passphrase");
    await user.click(screen.getByRole("button", { name: "Enroll this browser profile" }));

    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(complete.mock.calls[0].slice(0, 2)).toEqual([metadata, "dummy-passphrase"]);
    expect(input.value).toBe("");
    expect(await screen.findAllByText("This browser profile is enrolled for Keycloak sign-in.")).not.toHaveLength(0);
  });

  it("requires explicit confirmation and delegates server-first unlink cleanup", async () => {
    const props = propsWithStatus(true);
    const user = userEvent.setup();
    const unlink = jest.fn(() => ({ clientEnrollmentUuids: [] }));
    props.context.port.addRequestListener("passbolt.keycloak-sso.identity.unlink", unlink);

    renderPage(props);
    await user.click(await screen.findByRole("button", { name: "Unlink Keycloak" }));
    expect(unlink).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm unlink" }));

    await waitFor(() => expect(unlink).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Keycloak was unlinked. Normal Passbolt sign-in remains available.")).toBeTruthy();
  });

  it("does not expose enrollment controls when the plugin is disabled", async () => {
    const context = defaultAppContext();
    context.siteSettings.isPluginEnabled = jest.fn(() => false);
    renderPage({ context });

    expect(await screen.findByText("Keycloak sign-in is not enabled for this Passbolt server.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Authenticate with Keycloak to enroll" })).toBeNull();
  });

  it("fails closed without rendering link controls when authoritative status is unavailable", async () => {
    const props = propsWithStatus(false);
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enrollment.get-status", () => {
      throw new Error("Status unavailable");
    });

    renderPage(props);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Keycloak sign-in is unavailable. Normal Passbolt sign-in remains available.",
    );
    expect(screen.queryByRole("button", { name: "Link Keycloak identity" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Authenticate with Keycloak to enroll" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unlink Keycloak" })).toBeNull();
  });

  it("does not render sensitive background error details", async () => {
    const props = propsWithStatus(false);
    const user = userEvent.setup();
    props.context.port.addRequestListener("passbolt.keycloak-sso.crypto-enroll.start", () => {
      throw new Error("authorization_code=secret-code&state=secret-state");
    });

    renderPage(props);
    await user.click(await screen.findByRole("button", { name: "Authenticate with Keycloak to enroll" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Keycloak authentication could not be completed. Try again to start a fresh enrollment.",
    );
    expect(screen.queryByText(/secret-code|secret-state/)).toBeNull();
  });
});
