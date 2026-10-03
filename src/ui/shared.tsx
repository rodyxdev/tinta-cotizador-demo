import {
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { X, ImageOff, LoaderCircle } from "lucide-react";
import { db } from "../storage/store";
import { type State, statusLabels } from "../domain/model";
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button type="button" className={`btn ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Badge({
  status,
  children,
}: {
  status: string;
  children?: ReactNode;
}) {
  return (
    <span className={`badge ${status}`}>
      {children ?? statusLabels[status] ?? status}
    </span>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  const child = children as ReactElement<{
    id?: string;
    "aria-describedby"?: string;
  }>;
  const id = child.props?.id ?? generatedId;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(child)
        ? cloneElement(child, {
            id,
            "aria-describedby":
              [child.props["aria-describedby"], hint ? `${id}-hint` : undefined]
                .filter(Boolean)
                .join(" ") || undefined,
          })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <ImageOff size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      aria-labelledby="modal-title"
      className="modal"
    >
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <Button variant="ghost" onClick={onClose} aria-label="Cerrar ventana">
          <X size={20} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export async function imageURL(
  id: string,
  s: Pick<State, "images">,
): Promise<string> {
  const meta = s.images.find((i) => i.id === id);
  if (meta?.path) return import.meta.env.BASE_URL + meta.path;
  const record = await db.images.get(id);
  if (!record?.blob) throw new Error("No se encontró la imagen local.");
  return URL.createObjectURL(record.blob);
}
export function DesignImage({
  imageId,
  images,
  alt,
  className = "",
}: {
  imageId?: string;
  images: State["images"];
  alt: string;
  className?: string;
}) {
  const [url, setURL] = useState(""),
    [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false,
      objectURL = "";
    setURL("");
    setError(false);
    if (imageId)
      imageURL(imageId, { images })
        .then((url) => {
          objectURL = url;
          if (!cancelled) setURL(url);
          else if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    return () => {
      cancelled = true;
      if (objectURL.startsWith("blob:")) URL.revokeObjectURL(objectURL);
    };
  }, [imageId, images]);
  return (
    <div className={`design-image ${className}`}>
      {url && !error ? (
        <img src={url} alt={alt} onError={() => setError(true)} />
      ) : imageId && !error ? (
        <LoaderCircle size={24} className="spin" aria-label="Cargando diseño" />
      ) : (
        <div className="image-placeholder">
          <ImageOff />
          <span>{error ? "Imagen no disponible" : "Sin diseño todavía"}</span>
        </div>
      )}
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
