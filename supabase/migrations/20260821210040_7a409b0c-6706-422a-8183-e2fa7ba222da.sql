-- 1. Add country column (nullable = unknown)
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS country text;
CREATE INDEX IF NOT EXISTS idx_opportunities_country ON public.opportunities (country);

-- 2. Deterministic country derivation helper
CREATE OR REPLACE FUNCTION public.derive_opportunity_country(p_location text, p_event_url text, p_raw jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  loc text := lower(coalesce(p_location, ''));
  url text := lower(coalesce(p_event_url, ''));
  host text;
  tld text;
  rawc text;
  c text;
  countries text[][] := ARRAY[
    ['united kingdom','United Kingdom'],['england','United Kingdom'],['scotland','United Kingdom'],['wales','United Kingdom'],['northern ireland','United Kingdom'],
    ['canada','Canada'],['australia','Australia'],['new zealand','New Zealand'],['ireland','Ireland'],['germany','Germany'],['deutschland','Germany'],
    ['france','France'],['spain','Spain'],['españa','Spain'],['portugal','Portugal'],['italy','Italy'],['italia','Italy'],['netherlands','Netherlands'],['holland','Netherlands'],
    ['belgium','Belgium'],['luxembourg','Luxembourg'],['switzerland','Switzerland'],['austria','Austria'],['denmark','Denmark'],['norway','Norway'],['sweden','Sweden'],
    ['finland','Finland'],['iceland','Iceland'],['poland','Poland'],['czech','Czechia'],['slovakia','Slovakia'],['slovenia','Slovenia'],['croatia','Croatia'],
    ['serbia','Serbia'],['bosnia','Bosnia and Herzegovina'],['montenegro','Montenegro'],['north macedonia','North Macedonia'],['albania','Albania'],
    ['hungary','Hungary'],['romania','Romania'],['bulgaria','Bulgaria'],['greece','Greece'],['turkey','Turkey'],['türkiye','Turkey'],['ukraine','Ukraine'],
    ['russia','Russia'],['belarus','Belarus'],['lithuania','Lithuania'],['latvia','Latvia'],['estonia','Estonia'],['moldova','Moldova'],['cyprus','Cyprus'],['malta','Malta'],
    ['mexico','Mexico'],['méxico','Mexico'],['guatemala','Guatemala'],['el salvador','El Salvador'],['honduras','Honduras'],['nicaragua','Nicaragua'],
    ['costa rica','Costa Rica'],['panama','Panama'],['colombia','Colombia'],['venezuela','Venezuela'],['ecuador','Ecuador'],['peru','Peru'],['perú','Peru'],
    ['bolivia','Bolivia'],['chile','Chile'],['argentina','Argentina'],['uruguay','Uruguay'],['paraguay','Paraguay'],['brazil','Brazil'],['brasil','Brazil'],
    ['dominican republic','Dominican Republic'],['jamaica','Jamaica'],['trinidad','Trinidad and Tobago'],['bahamas','Bahamas'],['barbados','Barbados'],['cuba','Cuba'],
    ['india','India'],['pakistan','Pakistan'],['bangladesh','Bangladesh'],['sri lanka','Sri Lanka'],['nepal','Nepal'],
    ['china','China'],['hong kong','Hong Kong'],['taiwan','Taiwan'],['japan','Japan'],['south korea','South Korea'],['korea','South Korea'],
    ['singapore','Singapore'],['malaysia','Malaysia'],['indonesia','Indonesia'],['philippines','Philippines'],['thailand','Thailand'],['vietnam','Vietnam'],
    ['cambodia','Cambodia'],['myanmar','Myanmar'],['mongolia','Mongolia'],['kazakhstan','Kazakhstan'],['uzbekistan','Uzbekistan'],['azerbaijan','Azerbaijan'],
    ['georgia,','Georgia (country)'],['armenia','Armenia'],
    ['israel','Israel'],['palestine','Palestine'],['jordan','Jordan'],['lebanon','Lebanon'],['saudi arabia','Saudi Arabia'],['qatar','Qatar'],['kuwait','Kuwait'],
    ['bahrain','Bahrain'],['oman','Oman'],['united arab emirates','United Arab Emirates'],['uae','United Arab Emirates'],['dubai','United Arab Emirates'],['abu dhabi','United Arab Emirates'],
    ['iran','Iran'],['iraq','Iraq'],
    ['egypt','Egypt'],['morocco','Morocco'],['tunisia','Tunisia'],['algeria','Algeria'],['libya','Libya'],['sudan','Sudan'],['ethiopia','Ethiopia'],
    ['kenya','Kenya'],['uganda','Uganda'],['tanzania','Tanzania'],['rwanda','Rwanda'],['burundi','Burundi'],['somalia','Somalia'],
    ['nigeria','Nigeria'],['ghana','Ghana'],['senegal','Senegal'],['cameroon','Cameroon'],['ivory coast','Ivory Coast'],
    ['benin','Benin'],['togo','Togo'],['mali','Mali'],['burkina faso','Burkina Faso'],['niger','Niger'],['gambia','Gambia'],['sierra leone','Sierra Leone'],
    ['liberia','Liberia'],['zambia','Zambia'],['zimbabwe','Zimbabwe'],['malawi','Malawi'],['mozambique','Mozambique'],['botswana','Botswana'],
    ['namibia','Namibia'],['south africa','South Africa']
  ];
  cities text[][] := ARRAY[
    ['london','United Kingdom'],['birmingham, uk','United Kingdom'],['manchester, uk','United Kingdom'],['glasgow','United Kingdom'],['edinburgh','United Kingdom'],
    ['brighton','United Kingdom'],['bristol, uk','United Kingdom'],['leeds','United Kingdom'],['cardiff','United Kingdom'],['belfast','United Kingdom'],
    ['toronto','Canada'],['vancouver','Canada'],['montreal','Canada'],['montréal','Canada'],['ottawa','Canada'],['calgary','Canada'],['edmonton','Canada'],['quebec','Canada'],
    ['sydney','Australia'],['melbourne','Australia'],['brisbane','Australia'],['perth, au','Australia'],['adelaide','Australia'],['canberra','Australia'],
    ['auckland','New Zealand'],['wellington, nz','New Zealand'],
    ['dublin','Ireland'],['berlin','Germany'],['munich','Germany'],['münchen','Germany'],['hamburg','Germany'],['cologne','Germany'],['köln','Germany'],
    ['frankfurt','Germany'],['stuttgart','Germany'],['dresden','Germany'],['leipzig','Germany'],['nuremberg','Germany'],['karlsruhe','Germany'],
    ['paris','France'],['lyon','France'],['marseille','France'],['toulouse','France'],['bordeaux','France'],['nantes','France'],['lille','France'],['montpellier','France'],
    ['madrid','Spain'],['barcelona','Spain'],['valencia','Spain'],['seville','Spain'],['sevilla','Spain'],['bilbao','Spain'],['malaga','Spain'],['zaragoza','Spain'],
    ['lisbon','Portugal'],['lisboa','Portugal'],['porto','Portugal'],
    ['rome','Italy'],['roma','Italy'],['milan','Italy'],['milano','Italy'],['turin','Italy'],['torino','Italy'],['bologna','Italy'],['florence','Italy'],['naples','Italy'],['venice','Italy'],['mestre','Italy'],
    ['amsterdam','Netherlands'],['rotterdam','Netherlands'],['utrecht','Netherlands'],['eindhoven','Netherlands'],['groningen','Netherlands'],['the hague','Netherlands'],
    ['brussels','Belgium'],['antwerp','Belgium'],['ghent','Belgium'],['wilrijk','Belgium'],
    ['zurich','Switzerland'],['zürich','Switzerland'],['geneva','Switzerland'],['basel','Switzerland'],['bern','Switzerland'],['lausanne','Switzerland'],
    ['vienna','Austria'],['salzburg','Austria'],['graz','Austria'],
    ['copenhagen','Denmark'],['aarhus','Denmark'],['oslo','Norway'],['bergen','Norway'],['trondheim','Norway'],
    ['stockholm','Sweden'],['gothenburg','Sweden'],['malmö','Sweden'],['helsinki','Finland'],['tampere','Finland'],['reykjavik','Iceland'],
    ['warsaw','Poland'],['krakow','Poland'],['kraków','Poland'],['wroclaw','Poland'],['gdansk','Poland'],['poznan','Poland'],
    ['prague','Czechia'],['brno','Czechia'],['bratislava','Slovakia'],['ljubljana','Slovenia'],['zagreb','Croatia'],['belgrade','Serbia'],['sarajevo','Bosnia and Herzegovina'],
    ['budapest','Hungary'],['bucharest','Romania'],['cluj','Romania'],['iasi','Romania'],['timisoara','Romania'],['sofia','Bulgaria'],['athens, gr','Greece'],['thessaloniki','Greece'],
    ['istanbul','Turkey'],['ankara','Turkey'],['izmir','Turkey'],['kyiv','Ukraine'],['kiev','Ukraine'],['lviv','Ukraine'],
    ['vilnius','Lithuania'],['riga','Latvia'],['tallinn','Estonia'],
    ['mexico city','Mexico'],['guadalajara','Mexico'],['monterrey','Mexico'],['bogotá','Colombia'],['bogota','Colombia'],['medellin','Colombia'],['medellín','Colombia'],
    ['lima','Peru'],['quito','Ecuador'],['guayaquil','Ecuador'],['santiago de chile','Chile'],['valdivia','Chile'],['buenos aires','Argentina'],['montevideo','Uruguay'],
    ['são paulo','Brazil'],['sao paulo','Brazil'],['rio de janeiro','Brazil'],['florianópolis','Brazil'],['salvador, brazil','Brazil'],['belo horizonte','Brazil'],['recife','Brazil'],['curitiba','Brazil'],
    ['bengaluru','India'],['bangalore','India'],['mumbai','India'],['delhi','India'],['hyderabad','India'],['chennai','India'],['pune','India'],['kolkata','India'],
    ['ahmedabad','India'],['coimbatore','India'],['nagpur','India'],['gandhinagar','India'],['mangaluru','India'],['jaipur','India'],['kochi','India'],
    ['karachi','Pakistan'],['lahore','Pakistan'],['islamabad','Pakistan'],['dhaka','Bangladesh'],['colombo','Sri Lanka'],['kathmandu','Nepal'],
    ['beijing','China'],['shanghai','China'],['shenzhen','China'],['guangzhou','China'],['hangzhou','China'],['taipei','Taiwan'],
    ['tokyo','Japan'],['osaka','Japan'],['kyoto','Japan'],['fukuoka','Japan'],['seoul','South Korea'],['busan','South Korea'],
    ['kuala lumpur','Malaysia'],['jakarta','Indonesia'],['bandung','Indonesia'],['surabaya','Indonesia'],['pasuruan','Indonesia'],['bali','Indonesia'],
    ['manila','Philippines'],['cebu','Philippines'],['bangkok','Thailand'],['hanoi','Vietnam'],['ho chi minh','Vietnam'],['phnom penh','Cambodia'],
    ['almaty','Kazakhstan'],['astana','Kazakhstan'],['tashkent','Uzbekistan'],['baku','Azerbaijan'],['yerevan','Armenia'],['tbilisi','Georgia (country)'],
    ['tel aviv','Israel'],['jerusalem','Israel'],['haifa','Israel'],['amman','Jordan'],['beirut','Lebanon'],['riyadh','Saudi Arabia'],['jeddah','Saudi Arabia'],
    ['doha','Qatar'],['manama','Bahrain'],['muscat','Oman'],
    ['cairo','Egypt'],['ismailia','Egypt'],['alexandria, egypt','Egypt'],['casablanca','Morocco'],['rabat','Morocco'],['marrakech','Morocco'],['tunis','Tunisia'],
    ['nairobi','Kenya'],['mombasa','Kenya'],['kisii','Kenya'],['eldoret','Kenya'],['kampala','Uganda'],['mbarara','Uganda'],['arusha','Tanzania'],['dar es salaam','Tanzania'],['kigali','Rwanda'],
    ['lagos','Nigeria'],['abuja','Nigeria'],['abeokuta','Nigeria'],['ibadan','Nigeria'],['accra','Ghana'],['dakar','Senegal'],['douala','Cameroon'],['yaounde','Cameroon'],
    ['lusaka','Zambia'],['harare','Zimbabwe'],['lilongwe','Malawi'],['maputo','Mozambique'],['gaborone','Botswana'],['windhoek','Namibia'],
    ['johannesburg','South Africa'],['cape town','South Africa'],['durban','South Africa'],['pretoria','South Africa']
  ];
  tldmap text[][] := ARRAY[
    ['uk','United Kingdom'],['ca','Canada'],['au','Australia'],['nz','New Zealand'],['ie','Ireland'],['de','Germany'],['fr','France'],['es','Spain'],
    ['pt','Portugal'],['it','Italy'],['nl','Netherlands'],['be','Belgium'],['ch','Switzerland'],['at','Austria'],['dk','Denmark'],['no','Norway'],
    ['se','Sweden'],['fi','Finland'],['is','Iceland'],['pl','Poland'],['cz','Czechia'],['sk','Slovakia'],['si','Slovenia'],['hr','Croatia'],['rs','Serbia'],
    ['hu','Hungary'],['ro','Romania'],['bg','Bulgaria'],['gr','Greece'],['tr','Turkey'],['ua','Ukraine'],['ru','Russia'],['lt','Lithuania'],['lv','Latvia'],
    ['ee','Estonia'],['mx','Mexico'],['gt','Guatemala'],['cr','Costa Rica'],['co','Colombia'],['ec','Ecuador'],['pe','Peru'],['cl','Chile'],['ar','Argentina'],
    ['uy','Uruguay'],['br','Brazil'],['in','India'],['pk','Pakistan'],['bd','Bangladesh'],['lk','Sri Lanka'],['np','Nepal'],['cn','China'],['hk','Hong Kong'],
    ['tw','Taiwan'],['jp','Japan'],['kr','South Korea'],['sg','Singapore'],['my','Malaysia'],['id','Indonesia'],['ph','Philippines'],['th','Thailand'],
    ['vn','Vietnam'],['kz','Kazakhstan'],['az','Azerbaijan'],['ge','Georgia (country)'],['am','Armenia'],['il','Israel'],['jo','Jordan'],['lb','Lebanon'],
    ['sa','Saudi Arabia'],['qa','Qatar'],['ae','United Arab Emirates'],['eg','Egypt'],['ma','Morocco'],['tn','Tunisia'],['ke','Kenya'],['ug','Uganda'],
    ['tz','Tanzania'],['rw','Rwanda'],['ng','Nigeria'],['gh','Ghana'],['sn','Senegal'],['cm','Cameroon'],['zm','Zambia'],['zw','Zimbabwe'],['za','South Africa'],
    ['us','United States'],['gov','United States'],['edu','United States'],['mil','United States']
  ];
  i int;
BEGIN
  -- explicit US markers in location
  IF loc ~ '(united states|,\s*usa\b|\busa\b|\bu\.s\.a?\.?\b|,\s*us$|\bunited states of america\b)' THEN
    RETURN 'United States';
  END IF;

  -- explicit country names in location
  FOR i IN 1 .. array_length(countries, 1) LOOP
    IF position(countries[i][1] in loc) > 0 THEN
      RETURN countries[i][2];
    END IF;
  END LOOP;

  -- US state names / postal abbreviations in location
  IF loc ~ '(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia|puerto rico)' THEN
    RETURN 'United States';
  END IF;
  IF loc ~ '(^|[,\s])(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|ia|id|il|in|ks|ky|la|ma|md|me|mi|mn|mo|ms|mt|nc|nd|ne|nh|nj|nm|nv|ny|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|va|vt|wa|wi|wv|wy|dc)([\s,.]|$)' AND loc ~ ',' THEN
    RETURN 'United States';
  END IF;

  -- well known non-US cities
  FOR i IN 1 .. array_length(cities, 1) LOOP
    IF position(cities[i][1] in loc) > 0 THEN
      RETURN cities[i][2];
    END IF;
  END LOOP;

  -- raw_data hints
  IF p_raw IS NOT NULL THEN
    rawc := lower(coalesce(p_raw->>'country', p_raw->>'event_country', p_raw->>'location_country', ''));
    IF rawc <> '' THEN
      IF rawc ~ '(united states|^us$|^usa$)' THEN RETURN 'United States'; END IF;
      FOR i IN 1 .. array_length(countries, 1) LOOP
        IF position(countries[i][1] in rawc) > 0 THEN RETURN countries[i][2]; END IF;
      END LOOP;
    END IF;
  END IF;

  -- URL TLD
  IF url <> '' THEN
    host := split_part(regexp_replace(url, '^https?://', ''), '/', 1);
    tld := lower(split_part(host, '.', array_length(string_to_array(host, '.'), 1)));
    IF tld IS NOT NULL AND tld <> '' THEN
      FOR i IN 1 .. array_length(tldmap, 1) LOOP
        IF tld = tldmap[i][1] THEN RETURN tldmap[i][2]; END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NULL;
END;
$fn$;

-- 3. Restore the 210 deactivated non-US opportunities
UPDATE public.opportunities o
SET is_active = true
FROM public.opportunities_nonus_backup_20260821 b
WHERE b.id = o.id AND o.is_active = false;

-- 4. Backfill country on every opportunity
UPDATE public.opportunities
SET country = public.derive_opportunity_country(location, event_url, raw_data)
WHERE country IS NULL;

-- 5. Keep country fresh on insert/update
CREATE OR REPLACE FUNCTION public.trg_set_opportunity_country()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $t$
BEGIN
  IF NEW.country IS NULL THEN
    NEW.country := public.derive_opportunity_country(NEW.location, NEW.event_url, NEW.raw_data);
  END IF;
  RETURN NEW;
END;
$t$;

DROP TRIGGER IF EXISTS set_opportunity_country ON public.opportunities;
CREATE TRIGGER set_opportunity_country
BEFORE INSERT OR UPDATE OF location, event_url, raw_data ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.trg_set_opportunity_country();