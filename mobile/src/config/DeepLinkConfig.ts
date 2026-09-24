/**
 * DeepLinkConfig — Issue #543
 * "Configure standard Deep-Linking logic enabling URL interceptions globally"
 *
 * Defines:
 *  - URL scheme + universal link prefixes
 *  - Route-to-screen mapping (linking config for react-navigation)
 *  - Deep-link parser utility
 *  - Incoming URL handler (initial URL + subscription)
 *
 * Supported deep-link patterns:
 *   stellar://creator/:id          → CreatorProfile screen
 *   stellar://freelancers          → FreelancerDirectory screen
 *   stellar://freelancers/:id      → CreatorProfile screen (freelancer view)
 *   stellar://dashboard            → Dashboard screen
 *   stellar://messages/:id         → Messaging screen
 *   stellar://upload               → ImagePicker screen
 *
 * Universal links (HTTPS):
 *   https://stellar.app/creator/:id
 *   https://stellar.app/freelancers
 *   https://stellar.app/dashboard
 *   https://stellar.app/messages/:id
 *   https://stellar.app/upload
 *
 * Implementation lives in ./deepLinks/ — this file re-exports it so existing
 * imports of "config/DeepLinkConfig" keep working:
 *   routes.ts             prefixes + react-navigation path map
 *   linkingOptions.ts     LINKING_OPTIONS for <NavigationContainer>
 *   parser.ts             DeepLinkRoute type + parseDeepLink()
 *   useDeepLinkHandler.ts hook for handling incoming links
 *   builders.ts           buildDeepLink() / buildUniversalLink()
 */

export { DEEP_LINK_PREFIXES, DEEP_LINK_CONFIG } from "./deepLinks/routes";
export { LINKING_OPTIONS } from "./deepLinks/linkingOptions";
export { parseDeepLink } from "./deepLinks/parser";
export type { DeepLinkRoute } from "./deepLinks/parser";
export { useDeepLinkHandler } from "./deepLinks/useDeepLinkHandler";
export { buildDeepLink, buildUniversalLink } from "./deepLinks/builders";
