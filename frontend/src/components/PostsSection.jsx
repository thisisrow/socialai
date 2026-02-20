import PropTypes from "prop-types";

const renderMedia = (post) => {
  if (!post.media_url) {
    return <div className="media-placeholder">No preview</div>;
  }

  if (post.media_type === "VIDEO") {
    return (
      <video className="media-asset" controls preload="metadata">
        <source src={post.media_url} />
        Your browser does not support the video tag.
      </video>
    );
  }

  return (
    <img
      className="media-asset"
      src={post.media_url}
      alt={post.caption ? `Instagram post: ${post.caption}` : "Instagram post"}
      loading="lazy"
    />
  );
};

export default function PostsSection({ posts, contextMap, stateMap, onOpenContext, onToggleAutoReply }) {
  return (
    <section className="posts">
      <h2>Recent posts</h2>
      {!posts.length && <p className="muted">No posts loaded yet.</p>}

      <div className="media-grid">
        {posts.map((p) => {
          const ctx = contextMap?.[p.id] || "";
          const enabled = Boolean(stateMap?.[p.id]?.autoReplyEnabled);

          return (
            <article key={p.id} className="card">
              <div className="card-top">
                <p className="label">{p.media_type}</p>
                <a href={p.permalink} target="_blank" rel="noreferrer">
                  View on Instagram
                </a>
              </div>

              <div className="media-frame">{renderMedia(p)}</div>

              <p className="caption">{p.caption || "No caption"}</p>
              {/* <p className="timestamp">{p.timestamp}</p> */}

              <div className="card-actions">
                <button className="ghost-btn small-btn" type="button" onClick={() => onOpenContext(p.id)}>
                  {ctx ? "Edit context" : "Add context"}
                </button>

                {ctx && <span className="chip">Context saved</span>}

                <button
                  type="button"
                  className={enabled ? "toggle-btn on" : "toggle-btn off"}
                  onClick={() => onToggleAutoReply(p.id)}
                >
                  {enabled ? "AI Reply ON" : "AI Reply OFF"}
                </button>
              </div>

              <div className="comments">
                <p className="label">Comments</p>
                {p.comments?.length ? (
                  <ul>
                    {p.comments.map((c) => (
                      <li key={c.id}>
                        <span className="comment-user">{c.username || "unknown"}</span>: {c.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">No comments found.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

PostsSection.propTypes = {
  posts: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      media_type: PropTypes.string,
      media_url: PropTypes.string,
      permalink: PropTypes.string,
      caption: PropTypes.string,
      timestamp: PropTypes.string,
      comments: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          username: PropTypes.string,
          text: PropTypes.string,
        })
      ),
    })
  ).isRequired,
  contextMap: PropTypes.object,
  stateMap: PropTypes.object,
  onOpenContext: PropTypes.func.isRequired,
  onToggleAutoReply: PropTypes.func.isRequired,
};

PostsSection.defaultProps = {
  contextMap: {},
  stateMap: {},
};
