import PropTypes from "prop-types";

export default function AuthSection({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSignup,
  onLogin,
}) {
  return (
    <section className="token-box auth-card">
      <h2>Sign up / Login</h2>
      <div className="token-grid">
        <div>
          <p className="label">Email</p>
          <input
            className="code-block"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </div>
        <div>
          <p className="label">Password</p>
          <input
            className="code-block"
            type="password"
            autoComplete="current-password"
            placeholder="********"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
          />
        </div>
      </div>
      <div className="auth-actions">
        <button className="primary-btn" type="button" onClick={onSignup}>
          Sign up
        </button>
        <button className="ghost-btn" type="button" onClick={onLogin}>
          Login
        </button>
      </div>
    </section>
  );
}

AuthSection.propTypes = {
  email: PropTypes.string.isRequired,
  password: PropTypes.string.isRequired,
  onEmailChange: PropTypes.func.isRequired,
  onPasswordChange: PropTypes.func.isRequired,
  onSignup: PropTypes.func.isRequired,
  onLogin: PropTypes.func.isRequired,
};
