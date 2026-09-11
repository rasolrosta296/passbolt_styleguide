import { ManageQuickAccessMode } from "./ManageQuickAccessMode";

describe("Quickaccess::ManageQuickAccessMode", () => {
  const originalResizeObserver = global.ResizeObserver;

  afterEach(() => {
    window.history.pushState({}, "", "/");
    global.ResizeObserver = originalResizeObserver;
    jest.restoreAllMocks();
  });

  it("does not apply popup blur-close or resize behavior to a durable tab surface", () => {
    window.history.pushState({}, "", "?uiMode=detached&surface=tab");
    const context = {
      getDetached: jest.fn(() => true),
      getBootstrapFeature: jest.fn(() => "keycloak-sso"),
      closeWindow: jest.fn(),
      port: { emit: jest.fn() },
    };
    const component = new ManageQuickAccessMode({
      context,
      location: { search: "?uiMode=detached&surface=tab" },
    });
    const addEventListener = jest.spyOn(window, "addEventListener");
    global.ResizeObserver = jest.fn();

    component.handleCloseOutsideWindowEvent();
    component.handleResizeWindow();

    expect(addEventListener).not.toHaveBeenCalledWith("blur", expect.any(Function));
    expect(global.ResizeObserver).not.toHaveBeenCalled();
  });

  it("preserves close-on-blur and resize behavior for a detached popup", () => {
    window.history.pushState({}, "", "?uiMode=detached");
    const context = {
      getDetached: jest.fn(() => true),
      getBootstrapFeature: jest.fn(() => "keycloak-sso"),
      shouldCloseAtWindowBlur: true,
      closeWindow: jest.fn(),
      port: { emit: jest.fn() },
    };
    const component = new ManageQuickAccessMode({ context, location: { search: "?uiMode=detached" } });
    const addEventListener = jest.spyOn(window, "addEventListener");
    const observe = jest.fn();
    global.ResizeObserver = jest.fn(() => ({ observe }));

    component.handleCloseOutsideWindowEvent();
    component.handleResizeWindow();

    expect(addEventListener).toHaveBeenCalledWith("blur", expect.any(Function));
    expect(global.ResizeObserver).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(document.body);
  });
});
