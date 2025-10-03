# WebRTC Call Feature - Environment Variables

## Optional Configuration

For production deployments, you can configure TURN servers for better NAT traversal:

```bash
# TURN Server Configuration (Optional)
TURN_SERVER_URL=turn:your-turn-server.com:3478
TURN_USERNAME=your-turn-username
TURN_PASSWORD=your-turn-password
```

## Default Configuration

If no TURN servers are configured, the system will use Google's public STUN servers:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`

## Testing Without TURN Servers

For development and testing, STUN servers are usually sufficient for:
- Same network calls
- Simple NAT configurations
- Most home/office networks

## Production Considerations

For production deployments, consider:
1. **TURN Servers**: Required for complex NAT/firewall scenarios
2. **Load Balancing**: Multiple TURN servers for reliability
3. **Monitoring**: Track connection success rates
4. **Fallback**: Graceful degradation when TURN servers fail

## Popular TURN Server Providers

- **Twilio STUN/TURN**: `stun:global.stun.twilio.com:3478`
- **Xirsys**: Various global endpoints
- **Self-hosted**: Coturn, rfc5766-turn-server
- **Cloud providers**: AWS, Google Cloud, Azure

## Security Notes

- TURN servers can see media traffic
- Use TLS/TCP for TURN connections when possible
- Rotate TURN credentials regularly
- Monitor for unusual traffic patterns
