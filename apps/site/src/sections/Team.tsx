import { Picture } from '../components/Picture';
import { TEAM_COPY } from '../content/site';
import { TEAM } from '../content/team';
import { Reveal } from '../motion/Reveal';

export function Team() {
  return (
    <section id="team" className="section" aria-labelledby="team-title">
      <div className="container">
        <Reveal className="section-head">
          <h2 id="team-title" className="section-title">
            {TEAM_COPY.heading}
          </h2>
        </Reveal>
        <ul className="team">
          {TEAM.map((member, index) => (
            <Reveal as="li" key={member.id} className="team__member" index={index}>
              <div className="team__frame">
                <Picture
                className="team__photo"
                name={`team-${member.id}`}
                widths={[320, 480, 640]}
                sizes="(min-width: 64rem) 17rem, (min-width: 37.5rem) 45vw, 90vw"
                width={640}
                height={800}
                  alt=""
                />
              </div>
              <h3 className="team__name">{member.name}</h3>
              {member.role ? <p className="team__role">{member.role}</p> : null}
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
