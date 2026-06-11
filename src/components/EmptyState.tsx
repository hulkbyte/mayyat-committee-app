type EmptyStateProps = {
  title: string;
  body?: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
    </div>
  );
}
