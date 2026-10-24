# FixFlow design system

Built-in Image Gen generated the reference concepts. The actual UI uses HTML, Tailwind, local fonts, and SVG icons; no screenshot is shipped as an interactive page.

References: `design-concept.png`, `booking-concept.png`, `admin-concept.png`, `login-concept.png`.

## Tokens

- White content surfaces: `#ffffff`
- Dashboard canvas: `#f7f9fc`
- Ink: `#10203f`; muted: `#64748b`
- Primary cobalt: `#0866ff`; soft blue: `#edf5ff`; border: `#dce3ee`
- Font: locally bundled Noto Sans Thai, weights 400 / 600 / 700
- Panel radii: 12–16px; modal: 16px
- Icons: Lucide outlined, generally 18–24px, semantic colors for status

## Component families

1. Brand header, role-aware account menu and admin sidebar
2. Customer search band, service tabs, technician rows, sort/filter states
3. Booking modal and labelled forms with pending/error/success states
4. Dashboard metric panels, booking tables and links to management sections
5. Expandable editors for technicians, services and categories
6. Booking detail, cost breakdown, status history, simulation and review controls

## Responsive behavior

Customer columns collapse to one on mobile. Service tabs scroll horizontally. Admin sidebar becomes a horizontal menu. Tables have their own scroll container; the page itself stays within the viewport. Dialogs scroll vertically inside a 90dvh maximum height.

## Intentional functional differences from the generated concepts

- PostgreSQL seed and actual query counts replace invented/generated example values.
- Customer pages display Bangkok's 50 districts, real review aggregates and authenticated account controls.
- Login says the account becomes usable after confirmation; Supabase may create an unconfirmed Auth record before verification.
- Development-only demo controls and a clearly labelled demo banner are absent from production.
- Required service/district/availability fields and fee breakdown were added to the original booking form.
- Typography follows real Noto Sans Thai metrics. No photographic background from the generated booking state is used; the retained primary-screen design remains the backdrop.

## Final concept briefs (built-in Image Gen)

Admin: complete 1536×1024 Thai FixFlow admin dashboard; white surfaces, slate canvas, cobalt controls, navy text; header with customer navigation and account menu; sidebar with overview, bookings, technicians, services, users and settings; four actual-data metric panels; latest-bookings table with an empty state; three management links; code-native text and controls; no charts, fake records, trust claims, gradients or decorative illustrations.

Login: complete 1536×1024 Thai FixFlow Email OTP screen; white background and restrained two-column composition; left headline “บ้านพร้อม / เมื่อคุณพร้อม” and booking/tracking description; right labelled email form, “ส่งรหัสยืนยัน”, OTP explanation and confirmation copy; code-native controls; no photos, metrics, social logins or decorative imagery.
