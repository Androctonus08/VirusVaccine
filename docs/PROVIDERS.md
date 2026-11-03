# VPN and identity service setup

VirusVaccine offers setup guides and official links. It does not operate VPN servers, connect tunnels, collect provider credentials, or monitor identity. Its desktop status never claims those services are active. Complete setup and verify status with the provider.

## VPN

1. Choose a VPN provider that supplies WireGuard configuration, or operate your own server.
2. Install the [official WireGuard Windows client](https://www.wireguard.com/install/).
3. Obtain the configuration through your provider's account and import it into WireGuard. Configuration files contain private keys. Keep them out of Git, reports and screenshots.
4. Activate the tunnel in WireGuard and verify the connection, DNS behavior and leak-protection settings through the provider. The client alone supplies no VPN endpoint or service.

VirusVaccine does not change your routes, DNS, firewall or existing VPN. Provider prices, privacy terms and support are separate.

## Breach notifications

Open [Have I Been Pwned notification signup](https://haveibeenpwned.com/NotifyMe), enter your email on that website, review its terms, and verify your address using its email link. Notifications are sent by the provider. VirusVaccine never receives your address or notifications.

This covers breaches known to that provider. It does not supply credit monitoring, identity recovery, insurance or complete dark-web coverage.

## Adding a direct integration later

The current integration is an external setup flow. `src/main/protection.cjs` contains the fixed official URL allowlist; the renderer cannot open arbitrary destinations. No API key entry or simulated connected state is provided.

A direct adapter must separately implement authentication, consent, revoked/expired credentials, provider errors, verified live status, and disconnect/delete controls. Keep credentials in Windows secure storage and out of the renderer, Git and logs. Never ship a shared paid API key. Provider API terms and any subscription belong to the person configuring the service. HIBP's [official API documentation](https://haveibeenpwned.com/API/v3) describes authenticated breach-search requirements.
