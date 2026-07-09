import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import type { CommentEntry, Match } from '../types';

const NAME_KEY = 'courtiq_comment_name';

export default function CommentPanel({
  match,
  comments,
}: {
  match: Match;
  comments: CommentEntry[];
}) {
  const [name, setName] = useState(localStorage.getItem(NAME_KEY) ?? '');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const canPost = match.commentsEnabled && match.status === 'LIVE';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      localStorage.setItem(NAME_KEY, name);
      await api(`/api/matches/code/${match.code}/comments`, {
        method: 'POST',
        // Blank name → posted as "Anonymous"
        body: { ...(name.trim() ? { authorName: name.trim() } : {}), body },
      });
      setBody(''); // the new comment arrives via the socket broadcast
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError('Slow down — too many comments at once.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not post comment');
      }
    }
  }

  return (
    <div>
      {comments.length === 0 ? (
        <p className="muted">No comments yet.</p>
      ) : (
        comments.map((comment) => (
          <div className="comment-item" key={comment.id}>
            <span className={`comment-author${comment.isManager ? ' is-manager' : ''}`}>
              {comment.authorName}
            </span>
            {comment.body}
          </div>
        ))
      )}
      {canPost ? (
        <form onSubmit={submit} style={{ marginTop: '0.9rem' }}>
          <div className="field-row">
            <input
              className="input"
              style={{ maxWidth: '10rem' }}
              placeholder="Name (optional)"
              aria-label="Your name (optional)"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Say something…"
              aria-label="Comment"
              value={body}
              maxLength={300}
              required
              onChange={(e) => setBody(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              Post
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      ) : (
        <p className="muted" style={{ marginTop: '0.9rem' }}>
          {match.status === 'LIVE'
            ? 'Comments are disabled for this match.'
            : 'Comments open while the match is live.'}
        </p>
      )}
    </div>
  );
}
