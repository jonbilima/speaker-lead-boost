CREATE TABLE IF NOT EXISTS public.opportunities_country_backfill_20260825 AS
SELECT id, country FROM public.opportunities WHERE is_active AND country IS NULL;

GRANT SELECT ON public.opportunities_country_backfill_20260825 TO authenticated;
GRANT ALL ON public.opportunities_country_backfill_20260825 TO service_role;
ALTER TABLE public.opportunities_country_backfill_20260825 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read country backfill snapshot"
  ON public.opportunities_country_backfill_20260825
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TEMP TABLE sig AS
WITH base AS (
  SELECT o.id,
         lower(coalesce(o.event_name,'')||' | '||coalesce(o.organizer_name,'')||' | '||coalesce(o.location,'')) AS blob,
         lower(coalesce(substring(o.event_url from '^https?://([^/]+)'),'')) AS host,
         lower(coalesce(split_part(o.organizer_email,'@',2),'')) AS mail_domain
  FROM public.opportunities o
  WHERE o.is_active AND o.country IS NULL
),
res AS (
  SELECT b.id,
         lower(coalesce(
           (SELECT r.resolved_domain FROM public.aggregator_domain_resolution_20260821 r WHERE r.opportunity_id=b.id AND r.resolved_domain IS NOT NULL LIMIT 1),
           (SELECT r.resolved_domain FROM public.organizer_name_resolution_20260824 r WHERE r.opportunity_id=b.id AND r.resolved_domain IS NOT NULL LIMIT 1),
           (SELECT r.resolved_domain FROM public.organizer_domain_match_20260824 r WHERE r.opportunity_id=b.id AND r.resolved_domain IS NOT NULL LIMIT 1),
           '')) AS rdomain
  FROM base b
),
d AS (
  SELECT b.*, r.rdomain,
         b.host||' '||b.mail_domain||' '||r.rdomain AS domains
  FROM base b JOIN res r ON r.id=b.id
),
p AS (
  SELECT d.*,
    (SELECT string_agg(coalesce(oc.phone,''),' ')
       FROM public.organizer_contacts oc
      WHERE oc.phone IS NOT NULL
        AND (d.rdomain <> '' AND oc.domain = d.rdomain
             OR d.mail_domain <> '' AND oc.domain = d.mail_domain
             OR d.host <> '' AND oc.domain = d.host)) AS phones
  FROM d
)
SELECT id, blob, domains, coalesce(phones,'') AS phones,
  -- foreign signals
  (blob ~ '\y(canada|toronto|vancouver|montreal|ottawa|calgary|ontario|quebec|alberta|british columbia|united kingdom|england|scotland|wales|london|manchester|birmingham uk|edinburgh|glasgow|ireland|dublin|germany|berlin|munich|frankfurt|hamburg|cologne|france|paris|lyon|netherlands|amsterdam|rotterdam|utrecht|belgium|brussels|spain|madrid|barcelona|valencia|portugal|lisbon|porto|italy|rome|milan|turin|switzerland|zurich|geneva|basel|austria|vienna|sweden|stockholm|gothenburg|norway|oslo|denmark|copenhagen|finland|helsinki|iceland|reykjavik|poland|warsaw|krakow|czech|prague|slovakia|hungary|budapest|romania|bucharest|bulgaria|sofia|greece|athens|turkey|istanbul|ukraine|kyiv|estonia|tallinn|latvia|riga|lithuania|vilnius|croatia|zagreb|serbia|belgrade|slovenia|ljubljana|australia|sydney|melbourne|brisbane|perth|adelaide|new zealand|auckland|wellington|india|bangalore|bengaluru|mumbai|new delhi|hyderabad|chennai|pune|kolkata|singapore|malaysia|kuala lumpur|indonesia|jakarta|thailand|bangkok|vietnam|hanoi|philippines|manila|japan|tokyo|osaka|kyoto|china|beijing|shanghai|shenzhen|hong kong|taiwan|taipei|south korea|seoul|israel|tel aviv|jerusalem|united arab emirates|dubai|abu dhabi|qatar|doha|saudi arabia|riyadh|egypt|cairo|nigeria|lagos|abuja|kenya|nairobi|ghana|accra|south africa|johannesburg|cape town|durban|brazil|sao paulo|rio de janeiro|mexico city|guadalajara|argentina|buenos aires|chile|santiago|colombia|bogota|peru|lima|costa rica|panama city|europe|european)\y'
   OR domains ~ '\.(ca|co\.uk|uk|au|de|fr|nl|es|it|se|no|dk|fi|pl|cz|gr|tr|ie|ch|at|be|pt|in|sg|jp|cn|nz|kr|my|ph|id|th|vn|za|br|mx|ae|il|eu|ru|ua|hk|tw|ng|ke|ar|cl|co|pe|is|hu|ro|bg|hr|rs|si|ee|lv|lt)(\s|$)')
   AS foreign_sig,
  -- US signals
  (blob ~ '(,\s?)(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\y'
   OR blob ~ '\y(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|puerto rico)\y'
   OR blob ~ '\y(dfw|nyc|d\.c\.|washington dc|bay area|silicon valley|socal|norcal|midwest|new england|atlanta|austin|boston|charlotte|chicago|cincinnati|cleveland|columbus|dallas|denver|detroit|fort worth|houston|indianapolis|jacksonville|kansas city|las vegas|los angeles|louisville|memphis|miami|milwaukee|minneapolis|nashville|new orleans|oklahoma city|omaha|orlando|philadelphia|phoenix|pittsburgh|portland|raleigh|sacramento|salt lake city|san antonio|san diego|san francisco|san jose|seattle|st\. louis|saint louis|tampa|tucson|tulsa|scottsdale|st\. petersburg|baltimore|buffalo|richmond|albuquerque|boise|des moines|hartford|honolulu|anchorage)\y'
   OR blob ~ '\y(american|america|u\.s\.|usa|united states|national|nationwide|federal|state of)\y'
   OR domains ~ '\.(us|edu|gov|mil)(\s|$)'
   OR coalesce(phones,'') ~ '(^|[^0-9])(\+?1[\s\-\.\(]*)?[2-9][0-9]{2}[\s\-\.\)]+[2-9][0-9]{2}[\s\-\.]?[0-9]{4}')
   AS us_sig
FROM p;

UPDATE public.opportunities o
   SET country = 'International'
  FROM sig s
 WHERE o.id = s.id AND s.foreign_sig AND o.country IS NULL;

UPDATE public.opportunities o
   SET country = 'United States'
  FROM sig s
 WHERE o.id = s.id AND NOT s.foreign_sig AND s.us_sig AND o.country IS NULL;
