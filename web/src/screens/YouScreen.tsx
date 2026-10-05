import { useEffect, useState, type ReactNode } from "react";

import { api, type Garment } from "../api/client";
import { Icon } from "../components/Icons";
import { PhotoBooth } from "../components/PhotoBooth";
import { GarmentThumb } from "../components/GarmentThumb";
import { framePerson, isWellFramed } from "../lib/framePerson";
import { useObjectUrl } from "../lib/objectUrl";
import { useApp } from "../state/app";
import { closetWearable } from "../state/outfit";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's person photo and wardrobe. Shows the person photo and nearby
// closet items for quick outfit try-on. Taking a photo while a scan is open
// renders that garment on it at once and returns to the result.

/** Show person photo and browse closet for try-ons. */
export function YouScreen(): ReactNode {
  const { person, flow, navigate, openSheet, settings, outfit } = useApp();
  const [booth, setBooth] = useState(false);
  const [framing, setFraming] = useState<string | null>(null);
  const [closet, setCloset] = useState<Garment[]>([]);
  const [loadingCloset, setLoadingCloset] = useState(false);
  const photoUrl = useObjectUrl(person.photo);
  const back = (): void => navigate(flow.frame ? "result" : "home");

  useEffect(() => {
    let cancelled = false;
    setLoadingCloset(true);
    api
      .closet(settings.owner)
      .then((garments) => {
        if (!cancelled) setCloset(garments);
      })
      .catch(() => {
        if (!cancelled) setCloset([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCloset(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settings.owner]);

  if (booth) {
    return (
      <PhotoBooth
        onCancel={() => setBooth(false)}
        onPhoto={async (photo) => {
          // Keep the crop around the person, so "You" shows exactly who a render will dress
          const framed = await framePerson(photo).catch(() => null);
          const keep = framed?.found ? framed.image : photo;
          await person.save(keep);
          setBooth(false);
          setFraming(
            framed === null || isWellFramed(framed)
              ? null
              : !framed.found
                ? "We could not find you in this photo. Retake it standing, head to knees, facing the camera."
                : framed.people > 1
                  ? "More than one person is in this photo, so a render may dress the wrong one. Retake it alone."
                  : "You look small in this photo. Renders come out best when you fill the frame, head to knees.",
          );
          if (flow.scan.status === "done") {
            flow.requestRender(keep, "photo");
            navigate("result");
          }
        }}
      />
    );
  }

  const take = (): void => {
    if (!person.consent) person.giveConsent();
    setBooth(true);
  };

  const tryOn = (garment: Garment): void => {
    const wearable = closetWearable(settings.owner, garment);
    if (wearable) {
      outfit.add([wearable]);
      navigate("live");
    }
  };

  return (
    <section className="fc-page fc-you">
      <header className="fc-topbar is-solid">
        <button type="button" className="fc-round fc-back" onClick={back} aria-label="Back">
          <Icon name="arrow" />
        </button>
        <p className="fc-topbar-title">You</p>
        <button type="button" className="fc-round" onClick={() => openSheet("settings")} aria-label="Settings">
          <Icon name="gear" />
        </button>
      </header>

      {photoUrl ? (
        <>
          <div className="fc-portrait">
            <img src={photoUrl} alt="Your photo" />
          </div>

          <div className="fc-you-copy">
            <p className="fc-kicker">{settings.owner}</p>
            <h1 className="display">Ready to try things on</h1>
            {person.storageError && <p className="fc-error">{person.storageError}</p>}
          </div>

          <div className="fc-wardrobe">
            <p className="fc-muted" style={{ padding: "0 1rem", marginBottom: "1rem" }}>
              Tap any piece to see how it looks on you
            </p>
            {loadingCloset ? (
              <p className="fc-muted" style={{ textAlign: "center", padding: "2rem" }}>
                Loading wardrobe...
              </p>
            ) : closet.length > 0 ? (
              <div className="fc-closet-grid">
                {closet.map((garment) => (
                  <button
                    key={garment.id}
                    type="button"
                    className="fc-garment-tile"
                    onClick={() => tryOn(garment)}
                    aria-label={`Try on ${garment.tags.description}`}
                  >
                    <GarmentThumb owner={settings.owner} garment={garment} />
                    <span className="fc-tile-label">{garment.tags.description}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="fc-muted" style={{ textAlign: "center", padding: "2rem" }}>
                No garments yet. Browse the closet or add your own.
              </p>
            )}
          </div>

          <div className="fc-you-actions">
            <button type="button" className="fc-btn is-secondary" onClick={take}>
              <Icon name="camera" /> Retake photo
            </button>
            <button type="button" className="fc-btn is-secondary" onClick={() => navigate("closet")}>
              <Icon name="hanger" /> View full closet
            </button>
            <button type="button" className="fc-btn is-danger" onClick={() => void person.remove()}>
              <Icon name="trash" /> Delete photo
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="fc-portrait" data-empty={true}>
            <Icon name="person" />
          </div>

          <div className="fc-you-copy">
            <p className="fc-kicker">{settings.owner}</p>
            <h1 className="display">One photo, every garment</h1>
            <p className="fc-muted">
              Stand back, head to knees, plain wall if you can. The photo stays on this device and goes only to our
              try-on renderer. It is never saved anywhere else.
            </p>
            {person.storageError && <p className="fc-error">{person.storageError}</p>}
            {framing && <p className="fc-warning">{framing}</p>}
          </div>

          <div className="fc-you-actions">
            <button type="button" className="fc-btn is-primary" onClick={take}>
              <Icon name="camera" /> Take my photo
            </button>
          </div>
        </>
      )}
    </section>
  );
}
