// Surveillance.jsx — notification system + watch indicator

function WatchIndicator() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return (
    <div className="watch-indicator" title="He is watching">
      <div className="dot" />
      <span>Observed · live</span>
      <span className="rec-time">{hh}:{mm}:{ss}</span>
    </div>
  );
}

function NotifStack({ notifs }) {
  return null;
}

window.WatchIndicator = WatchIndicator;
window.NotifStack = NotifStack;
