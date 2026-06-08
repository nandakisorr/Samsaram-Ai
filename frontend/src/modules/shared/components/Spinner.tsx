export function Spinner({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  const sizeMap = {
    small: '16px',
    medium: '24px',
    large: '40px',
  };

  return (
    <div
      style={{
        width: sizeMap[size],
        height: sizeMap[size],
        border: `2px solid #e5e7eb`,
        borderTopColor: '#6366f1',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}
