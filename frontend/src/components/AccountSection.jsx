import PropTypes from "prop-types";

export default function AccountSection({ authCode, loginUrl, onConnectInstagram, onSaveConnection, onLoadPosts }) {
  return (
    <div className="account-actions">
      <div className="button-container">
        <button className="primary-btn" type="button" onClick={() => onConnectInstagram(loginUrl)}>
          Connect Instagram
        </button>
        {authCode && (
          <button className="ghost-btn" type="button" onClick={onSaveConnection}>
            Save Instagram Connection
          </button>
        )}
        <button className="ghost-btn" type="button" onClick={onLoadPosts}>
          Load posts to SocialAI
        </button>
      </div>
    </div>
  );
}

AccountSection.propTypes = {
  authCode: PropTypes.string.isRequired,
  loginUrl: PropTypes.string.isRequired,
  onConnectInstagram: PropTypes.func.isRequired,
  onSaveConnection: PropTypes.func.isRequired,
  onLoadPosts: PropTypes.func.isRequired,
};
