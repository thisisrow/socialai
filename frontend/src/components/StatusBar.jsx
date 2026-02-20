import PropTypes from "prop-types";

export default function StatusBar({ status, error }) {
  if (!status && !error) return null;

  return (
    <section className="status-bar">
      {status && <div className="status-chip">{status}</div>}
      {error && <div className="error-chip">Error: {error}</div>}
    </section>
  );
}

StatusBar.propTypes = {
  status: PropTypes.string,
  error: PropTypes.string,
};

StatusBar.defaultProps = {
  status: "",
  error: "",
};
