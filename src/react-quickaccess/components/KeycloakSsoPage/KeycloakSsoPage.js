import React from "react";
import PropTypes from "prop-types";
import { Link, withRouter } from "react-router-dom";
import { Trans, withTranslation } from "react-i18next";
import Password from "../../../shared/components/Password/Password";
import SpinnerSVG from "../../../img/svg/spinner.svg";
import { withAppContext } from "../../../shared/context/AppContext/AppContext";

class KeycloakSsoPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      processing: false,
      enrolled: false,
      enrollmentMetadata: null,
      passphrase: "",
      confirmUnlink: false,
      message: "",
      error: "",
    };
    this.handleStartEnrollment = this.handleStartEnrollment.bind(this);
    this.handleCompleteEnrollment = this.handleCompleteEnrollment.bind(this);
    this.handlePassphraseChange = this.handlePassphraseChange.bind(this);
    this.handleCancelEnrollment = this.handleCancelEnrollment.bind(this);
    this.handleConfirmUnlink = this.handleConfirmUnlink.bind(this);
  }

  async componentDidMount() {
    if (!this.isEnabled) {
      this.setState({ loading: false });
      return;
    }
    try {
      const result = await this.props.context.port.request("passbolt.keycloak-sso.crypto-enrollment.get-status");
      if (typeof result?.enrolled !== "boolean") {
        throw new Error("The extension returned an invalid Keycloak enrollment status.");
      }
      this.setState({ loading: false, enrolled: result.enrolled });
    } catch {
      this.setState({
        loading: false,
        error: this.props.t("Keycloak sign-in is unavailable. Normal Passbolt sign-in remains available."),
      });
    }
  }

  get isEnabled() {
    return this.props.context.siteSettings?.isPluginEnabled("keycloakSso") === true;
  }

  async handleStartEnrollment() {
    this.setState({ processing: true, message: "", error: "" });
    if (this.props.context.getDetached() !== true) {
      try {
        await this.props.context.port.request("passbolt.keycloak-sso.crypto-enroll.open-detached");
        await this.props.context.closeWindow();
      } catch (error) {
        if (error?.name !== "UserAbortsOperationError") {
          this.setState({
            error: this.props.t(
              "Keycloak authentication could not be completed. Try again to start a fresh enrollment.",
            ),
          });
        }
      } finally {
        this.setState({ processing: false });
      }
      return;
    }

    const closeAtBlur = this.props.context.shouldCloseAtWindowBlur;
    this.props.context.setWindowBlurBehaviour(false);
    try {
      const enrollmentMetadata = await this.props.context.port.request("passbolt.keycloak-sso.crypto-enroll.start");
      this.setState({ enrollmentMetadata });
    } catch (error) {
      if (error?.name !== "UserAbortsOperationError") {
        this.setState({
          error: this.props.t("Keycloak authentication could not be completed. Try again to start a fresh enrollment."),
        });
      }
    } finally {
      this.props.context.setWindowBlurBehaviour(closeAtBlur);
      this.setState({ processing: false });
    }
  }

  async handleCompleteEnrollment(event) {
    event.preventDefault();
    if (this.state.passphrase.length === 0 || this.state.enrollmentMetadata === null) {
      this.setState({ error: this.props.t("The passphrase should not be empty.") });
      return;
    }
    let passphrase = this.state.passphrase;
    const enrollmentMetadata = this.state.enrollmentMetadata;
    this.setState({ processing: true, passphrase: "", error: "", message: "" });
    try {
      await this.props.context.port.request(
        "passbolt.keycloak-sso.crypto-enroll.complete",
        enrollmentMetadata,
        passphrase,
      );
      this.setState({
        enrolled: true,
        enrollmentMetadata: null,
        message: this.props.t("This browser profile is enrolled for Keycloak sign-in."),
      });
    } catch {
      this.setState({
        error: this.props.t(
          "Browser-profile enrollment failed. Check your Passbolt passphrase and restart Keycloak authentication.",
        ),
        enrollmentMetadata: null,
      });
    } finally {
      passphrase = null;
      this.setState({ processing: false, passphrase: "" });
    }
  }

  handlePassphraseChange(event) {
    this.setState({ passphrase: event.target.value });
  }

  handleCancelEnrollment() {
    this.setState({ enrollmentMetadata: null, passphrase: "", error: "" });
  }

  async handleConfirmUnlink() {
    this.setState({ processing: true, error: "", message: "" });
    try {
      await this.props.context.port.request("passbolt.keycloak-sso.identity.unlink");
      this.setState({
        enrolled: false,
        confirmUnlink: false,
        enrollmentMetadata: null,
        passphrase: "",
        message: this.props.t("Keycloak was unlinked. Normal Passbolt sign-in remains available."),
      });
    } catch {
      this.setState({
        error: this.props.t(
          "Keycloak unlink failed. The enrollment remains active; try again before removing local data.",
        ),
      });
    } finally {
      this.setState({ processing: false });
    }
  }

  render() {
    return (
      <div className="keycloak-sso-page login-form">
        <div className="back-link">
          <Link className="primary-action" to="/webAccessibleResources/quickaccess/home">
            <span className="primary-action-title">
              <Trans>Keycloak SSO</Trans>
            </span>
          </Link>
        </div>
        {this.state.loading && (
          <div className="processing-wrapper">
            <SpinnerSVG />
          </div>
        )}
        {!this.state.loading && !this.isEnabled && (
          <div className="error-message" role="alert">
            <Trans>Keycloak sign-in is not enabled for this Passbolt server.</Trans>
          </div>
        )}
        {!this.state.loading && this.isEnabled && !this.state.enrollmentMetadata && (
          <div className="form-container">
            <p>
              {this.state.enrolled ? (
                <Trans>This browser profile is enrolled for Keycloak sign-in.</Trans>
              ) : (
                <Trans>This browser profile is not enrolled for Keycloak sign-in.</Trans>
              )}
            </p>
            {!this.state.enrolled && (
              <button
                type="button"
                className={`button primary big full-width ${this.state.processing ? "processing" : ""}`}
                disabled={this.state.processing}
                onClick={this.handleStartEnrollment}
              >
                <Trans>Authenticate with Keycloak to enroll</Trans>
                {this.state.processing && <SpinnerSVG />}
              </button>
            )}
            {this.state.enrolled && !this.state.confirmUnlink && (
              <button
                type="button"
                className="button warning big full-width"
                disabled={this.state.processing}
                onClick={() => this.setState({ confirmUnlink: true, error: "", message: "" })}
              >
                <Trans>Unlink Keycloak</Trans>
              </button>
            )}
            {this.state.enrolled && this.state.confirmUnlink && (
              <div className="keycloak-unlink-confirmation">
                <p>
                  <Trans>
                    Unlinking revokes all Keycloak unlock enrollments. Your normal Passbolt passphrase remains
                    available.
                  </Trans>
                </p>
                <button
                  type="button"
                  className="button warning big full-width"
                  disabled={this.state.processing}
                  onClick={this.handleConfirmUnlink}
                >
                  <Trans>Confirm unlink</Trans>
                  {this.state.processing && <SpinnerSVG />}
                </button>
                <button
                  type="button"
                  className="button link full-width"
                  disabled={this.state.processing}
                  onClick={() => this.setState({ confirmUnlink: false })}
                >
                  <Trans>Cancel</Trans>
                </button>
              </div>
            )}
          </div>
        )}
        {this.state.enrollmentMetadata && (
          <form onSubmit={this.handleCompleteEnrollment}>
            <div className="form-container">
              <p>
                <Trans>
                  Keycloak authentication succeeded. Enter your Passbolt passphrase to enroll this browser profile.
                </Trans>
              </p>
              <div className="input-password-wrapper input required">
                <label htmlFor="keycloak-enrollment-passphrase">
                  <Trans>Passphrase</Trans>
                </label>
                <Password
                  id="keycloak-enrollment-passphrase"
                  name="passphrase"
                  value={this.state.passphrase}
                  onChange={this.handlePassphraseChange}
                  disabled={this.state.processing}
                  autoComplete="off"
                  preview={false}
                  securityToken={this.props.context.userSettings.getSecurityToken()}
                />
              </div>
            </div>
            <div className="submit-wrapper">
              <button
                type="submit"
                className={`button primary big full-width ${this.state.processing ? "processing" : ""}`}
                disabled={this.state.processing}
              >
                <Trans>Enroll this browser profile</Trans>
                {this.state.processing && <SpinnerSVG />}
              </button>
              <button
                type="button"
                className="button link full-width"
                disabled={this.state.processing}
                onClick={this.handleCancelEnrollment}
              >
                <Trans>Cancel</Trans>
              </button>
            </div>
          </form>
        )}
        {this.state.message && (
          <div className="success-message" role="status" aria-live="polite">
            {this.state.message}
          </div>
        )}
        {this.state.error && (
          <div className="error-message" role="alert">
            {this.state.error}
          </div>
        )}
      </div>
    );
  }
}

KeycloakSsoPage.propTypes = {
  context: PropTypes.any,
  t: PropTypes.func,
};

export default withAppContext(withRouter(withTranslation("common")(KeycloakSsoPage)));
