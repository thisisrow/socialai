import PropTypes from "prop-types";
import Modal from "./Modal";

export default function ContextModal({ open, draft, onChange, onSave, onDelete, onClose }) {
  return (
    <Modal open={open} title="Post context" onClose={onClose}>
      <p className="muted small">Saved in MongoDB. Used for AI replies on this post.</p>

      <textarea
        className="context-textarea"
        rows={7}
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write context for this post..."
      />

      <div className="modal-actions">
        <button className="primary-btn" type="button" onClick={onSave}>
          Save
        </button>
        <button className="danger-btn" type="button" onClick={onDelete}>
          Delete
        </button>
      </div>
    </Modal>
  );
}

ContextModal.propTypes = {
  open: PropTypes.bool.isRequired,
  draft: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
