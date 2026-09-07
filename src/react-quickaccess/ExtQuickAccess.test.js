import ExtQuickAccess, { BOOTSTRAP_FEATURE } from "./ExtQuickAccess";

describe("ExtQuickAccess bootstrap routes", () => {
  it("bootstraps authenticated Keycloak SSO Quick Access on its dedicated route", () => {
    const quickAccess = Object.create(ExtQuickAccess.prototype);
    quickAccess.state = { isAuthenticated: true };
    quickAccess.props = { bootstrapFeature: BOOTSTRAP_FEATURE.KEYCLOAK_SSO };

    expect(BOOTSTRAP_FEATURE.KEYCLOAK_SSO).toBe("keycloak-sso");
    expect(quickAccess.getBootstrapRoute()).toBe("/webAccessibleResources/quickaccess/keycloak-sso");
  });

  it("does not bypass login when Keycloak SSO is bootstrapped unauthenticated", () => {
    const quickAccess = Object.create(ExtQuickAccess.prototype);
    quickAccess.state = { isAuthenticated: false };
    quickAccess.props = { bootstrapFeature: BOOTSTRAP_FEATURE.KEYCLOAK_SSO };

    expect(quickAccess.getBootstrapRoute()).toBe("/webAccessibleResources/quickaccess/login");
  });
});
