--
-- PostgreSQL database dump
--

\restrict 0E8oo9QeAETfkOKpd1KeD56vtHyVmjNKoURhhI0jWK3Pjk5F1aoGT5so1daRKrV

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: incentive_user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO incentive_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: doctors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.doctors (
    doctor_id character varying(20) NOT NULL,
    doctor_name character varying(200) NOT NULL,
    specialization character varying(100),
    territory_id character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT doctors_status_check CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::text[])))
);


ALTER TABLE public.doctors OWNER TO postgres;

--
-- Name: incentive_payouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incentive_payouts (
    payout_id character varying(20) NOT NULL,
    representative_id character varying(20) NOT NULL,
    product_id character varying(20) NOT NULL,
    program_id character varying(20) NOT NULL,
    payout_month date NOT NULL,
    sales_target numeric(15,2) DEFAULT 0 NOT NULL,
    actual_sales numeric(15,2) DEFAULT 0 NOT NULL,
    sales_achievement numeric(8,2) DEFAULT 0 NOT NULL,
    base_incentive numeric(15,2) DEFAULT 0 NOT NULL,
    achievement_multiplier numeric(6,2) DEFAULT 0 NOT NULL,
    calculated_payout numeric(15,2) DEFAULT 0 NOT NULL,
    maximum_payout numeric(15,2) DEFAULT 0 NOT NULL,
    expected_payout numeric(15,2) DEFAULT 0 NOT NULL,
    actual_payout numeric(15,2) DEFAULT 0 NOT NULL,
    payout_difference numeric(15,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'Pending'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT incentive_payouts_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Paid'::character varying, 'Adjusted'::character varying])::text[])))
);


ALTER TABLE public.incentive_payouts OWNER TO postgres;

--
-- Name: incentive_programs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incentive_programs (
    program_id character varying(20) NOT NULL,
    program_name character varying(200) NOT NULL,
    period_type character varying(20) DEFAULT 'Monthly'::character varying NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    minimum_sales_achievement numeric(6,2) DEFAULT 80 NOT NULL,
    maximum_payout_multiplier numeric(6,2) DEFAULT 125 NOT NULL,
    status character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_max_payout_multiplier CHECK ((maximum_payout_multiplier >= (0)::numeric)),
    CONSTRAINT chk_min_sales_achievement CHECK ((minimum_sales_achievement >= (0)::numeric)),
    CONSTRAINT chk_program_dates CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT incentive_programs_period_type_check CHECK (((period_type)::text = ANY ((ARRAY['Monthly'::character varying, 'Quarterly'::character varying, 'Annual'::character varying])::text[]))),
    CONSTRAINT incentive_programs_status_check CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::text[])))
);


ALTER TABLE public.incentive_programs OWNER TO postgres;

--
-- Name: incentive_tiers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.incentive_tiers (
    tier_id character varying(20) NOT NULL,
    program_id character varying(20) NOT NULL,
    minimum_achievement numeric(6,2) NOT NULL,
    maximum_achievement numeric(6,2),
    payout_multiplier numeric(6,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_tier_maximum CHECK (((maximum_achievement IS NULL) OR (maximum_achievement > minimum_achievement))),
    CONSTRAINT chk_tier_minimum CHECK ((minimum_achievement >= (0)::numeric)),
    CONSTRAINT chk_tier_multiplier CHECK ((payout_multiplier >= (0)::numeric))
);


ALTER TABLE public.incentive_tiers OWNER TO postgres;

--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prescriptions (
    prescription_id character varying(20) NOT NULL,
    prescription_date date NOT NULL,
    doctor_id character varying(20) NOT NULL,
    product_id character varying(20) NOT NULL,
    quantity integer NOT NULL,
    status character varying(20) DEFAULT 'Valid'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT prescriptions_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT prescriptions_status_check CHECK (((status)::text = ANY ((ARRAY['Valid'::character varying, 'Cancelled'::character varying, 'Reversed'::character varying])::text[])))
);


ALTER TABLE public.prescriptions OWNER TO postgres;

--
-- Name: product_incentive_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_incentive_rates (
    rate_id character varying(20) NOT NULL,
    program_id character varying(20) NOT NULL,
    product_id character varying(20) NOT NULL,
    incentive_rate numeric(6,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT product_incentive_rates_incentive_rate_check CHECK ((incentive_rate >= (0)::numeric))
);


ALTER TABLE public.product_incentive_rates OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    product_id character varying(20) NOT NULL,
    product_name character varying(200) NOT NULL,
    product_category character varying(100),
    status character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT products_status_check CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::text[])))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: representative_doctor_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.representative_doctor_assignments (
    assignment_id character varying(20) NOT NULL,
    representative_id character varying(20) NOT NULL,
    doctor_id character varying(20) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    status character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_assignment_dates CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT representative_doctor_assignments_status_check CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying, 'Cancelled'::character varying])::text[])))
);


ALTER TABLE public.representative_doctor_assignments OWNER TO postgres;

--
-- Name: representatives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.representatives (
    representative_id character varying(20) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    territory_id character varying(20) NOT NULL,
    joining_date date NOT NULL,
    status character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT representatives_status_check CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::text[])))
);


ALTER TABLE public.representatives OWNER TO postgres;

--
-- Name: sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales (
    sale_id character varying(20) NOT NULL,
    sale_date date NOT NULL,
    doctor_id character varying(20) NOT NULL,
    product_id character varying(20) NOT NULL,
    selling_territory_id character varying(20) NOT NULL,
    quantity integer NOT NULL,
    sales_amount numeric(15,2) NOT NULL,
    status character varying(20) DEFAULT 'Valid'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT sales_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT sales_sales_amount_check CHECK ((sales_amount >= (0)::numeric)),
    CONSTRAINT sales_status_check CHECK (((status)::text = ANY ((ARRAY['Valid'::character varying, 'Cancelled'::character varying, 'Returned'::character varying, 'Adjusted'::character varying])::text[])))
);


ALTER TABLE public.sales OWNER TO postgres;

--
-- Name: sales_targets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_targets (
    target_id character varying(20) NOT NULL,
    representative_id character varying(20) NOT NULL,
    product_id character varying(20) NOT NULL,
    target_month date NOT NULL,
    target_amount numeric(15,2) NOT NULL,
    status character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT sales_targets_status_check CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::text[]))),
    CONSTRAINT sales_targets_target_amount_check CHECK ((target_amount >= (0)::numeric))
);


ALTER TABLE public.sales_targets OWNER TO postgres;

--
-- Name: territories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.territories (
    territory_id character varying(20) NOT NULL,
    territory_name character varying(100) NOT NULL,
    region character varying(100) NOT NULL,
    country character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT territories_status_check CHECK (((status)::text = ANY ((ARRAY['Active'::character varying, 'Inactive'::character varying])::text[])))
);


ALTER TABLE public.territories OWNER TO postgres;

--
-- Data for Name: doctors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.doctors (doctor_id, doctor_name, specialization, territory_id, status, created_at, updated_at) FROM stdin;
D001	Dr Mehta	Cardiology	T001	Active	2026-08-16 14:00:53.351429	2026-08-16 14:00:53.351429
D002	Dr Sharma	General Medicine	T001	Active	2026-08-16 14:00:53.351429	2026-08-16 14:00:53.351429
D003	Dr Kulkarni	Cardiology	T002	Active	2026-08-16 14:00:53.351429	2026-08-16 14:00:53.351429
\.


--
-- Data for Name: incentive_payouts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.incentive_payouts (payout_id, representative_id, product_id, program_id, payout_month, sales_target, actual_sales, sales_achievement, base_incentive, achievement_multiplier, calculated_payout, maximum_payout, expected_payout, actual_payout, payout_difference, status, created_at, updated_at) FROM stdin;
PAY001	FR001	P001	IP001	2026-07-01	100000.00	125000.00	125.00	5000.00	125.00	6250.00	6250.00	6250.00	9000.00	2750.00	Paid	2026-08-16 14:59:48.391875	2026-08-16 14:59:48.391875
PAY002	FR001	P002	IP001	2026-07-01	50000.00	40000.00	80.00	3500.00	50.00	1750.00	4375.00	1750.00	1750.00	0.00	Paid	2026-08-16 14:59:48.391875	2026-08-16 14:59:48.391875
PAY003	FR002	P001	IP001	2026-07-01	50000.00	60000.00	120.00	2500.00	125.00	3125.00	3125.00	3125.00	8000.00	4875.00	Paid	2026-08-16 14:59:48.391875	2026-08-16 14:59:48.391875
\.


--
-- Data for Name: incentive_programs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.incentive_programs (program_id, program_name, period_type, effective_from, effective_to, minimum_sales_achievement, maximum_payout_multiplier, status, created_at, updated_at) FROM stdin;
IP001	FY2026 Monthly Sales Incentive	Monthly	2026-01-01	2026-12-31	80.00	125.00	Active	2026-08-16 14:02:12.242392	2026-08-16 14:02:12.242392
\.


--
-- Data for Name: incentive_tiers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.incentive_tiers (tier_id, program_id, minimum_achievement, maximum_achievement, payout_multiplier, created_at, updated_at) FROM stdin;
IT001	IP001	0.00	80.00	0.00	2026-08-16 14:02:12.243772	2026-08-16 14:02:12.243772
IT002	IP001	80.00	100.00	50.00	2026-08-16 14:02:12.243772	2026-08-16 14:02:12.243772
IT003	IP001	100.00	120.00	100.00	2026-08-16 14:02:12.243772	2026-08-16 14:02:12.243772
IT004	IP001	120.00	\N	125.00	2026-08-16 14:02:12.243772	2026-08-16 14:02:12.243772
\.


--
-- Data for Name: prescriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.prescriptions (prescription_id, prescription_date, doctor_id, product_id, quantity, status, created_at, updated_at) FROM stdin;
PR001	2026-07-10	D001	P001	20	Valid	2026-08-16 14:00:53.357084	2026-08-16 14:00:53.357084
PR002	2026-07-12	D002	P002	15	Valid	2026-08-16 14:00:53.357084	2026-08-16 14:00:53.357084
PR003	2026-07-14	D003	P001	18	Valid	2026-08-16 14:00:53.357084	2026-08-16 14:00:53.357084
PR101	2026-04-10	D001	P001	80	Valid	2026-08-16 15:08:23.80499	2026-08-16 15:08:23.80499
PR102	2026-05-10	D001	P001	82	Valid	2026-08-16 15:08:23.80499	2026-08-16 15:08:23.80499
PR103	2026-06-10	D001	P001	85	Valid	2026-08-16 15:08:23.80499	2026-08-16 15:08:23.80499
\.


--
-- Data for Name: product_incentive_rates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_incentive_rates (rate_id, program_id, product_id, incentive_rate, created_at, updated_at) FROM stdin;
IR001	IP001	P001	5.00	2026-08-16 14:02:12.245904	2026-08-16 14:02:12.245904
IR002	IP001	P002	7.00	2026-08-16 14:02:12.245904	2026-08-16 14:02:12.245904
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (product_id, product_name, product_category, status, created_at, updated_at) FROM stdin;
P001	Product A	Cardiology	Active	2026-08-16 14:00:53.3556	2026-08-16 14:00:53.3556
P002	Product B	General Medicine	Active	2026-08-16 14:00:53.3556	2026-08-16 14:00:53.3556
\.


--
-- Data for Name: representative_doctor_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.representative_doctor_assignments (assignment_id, representative_id, doctor_id, effective_from, effective_to, status, created_at, updated_at) FROM stdin;
A001	FR001	D001	2026-01-01	\N	Active	2026-08-16 14:00:53.353254	2026-08-16 14:00:53.353254
A002	FR001	D002	2026-01-01	\N	Active	2026-08-16 14:00:53.353254	2026-08-16 14:00:53.353254
A003	FR002	D003	2026-01-01	\N	Active	2026-08-16 14:00:53.353254	2026-08-16 14:00:53.353254
\.


--
-- Data for Name: representatives; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.representatives (representative_id, first_name, last_name, territory_id, joining_date, status, created_at, updated_at) FROM stdin;
FR001	Rahul	Sharma	T001	2025-01-15	Active	2026-08-16 14:00:53.34971	2026-08-16 14:00:53.34971
FR002	Priya	Patel	T002	2025-03-10	Active	2026-08-16 14:00:53.34971	2026-08-16 14:00:53.34971
\.


--
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales (sale_id, sale_date, doctor_id, product_id, selling_territory_id, quantity, sales_amount, status, created_at, updated_at) FROM stdin;
S001	2026-07-15	D001	P001	T002	100	50000.00	Valid	2026-08-16 14:00:53.359049	2026-08-16 14:00:53.359049
S002	2026-07-18	D001	P001	T001	150	75000.00	Valid	2026-08-16 14:00:53.359049	2026-08-16 14:00:53.359049
S003	2026-07-20	D002	P002	T001	80	40000.00	Valid	2026-08-16 14:00:53.359049	2026-08-16 14:00:53.359049
S004	2026-07-22	D003	P001	T001	120	60000.00	Valid	2026-08-16 14:00:53.359049	2026-08-16 14:00:53.359049
S101	2026-04-10	D001	P001	T001	80	80000.00	Valid	2026-08-16 15:05:17.381877	2026-08-16 15:05:17.381877
S102	2026-05-12	D001	P001	T001	85	85000.00	Valid	2026-08-16 15:05:17.381877	2026-08-16 15:05:17.381877
S103	2026-06-14	D001	P001	T001	90	90000.00	Valid	2026-08-16 15:05:17.381877	2026-08-16 15:05:17.381877
\.


--
-- Data for Name: sales_targets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sales_targets (target_id, representative_id, product_id, target_month, target_amount, status, created_at, updated_at) FROM stdin;
ST001	FR001	P001	2026-07-01	100000.00	Active	2026-08-16 14:02:12.240377	2026-08-16 14:02:12.240377
ST002	FR001	P002	2026-07-01	50000.00	Active	2026-08-16 14:02:12.240377	2026-08-16 14:02:12.240377
ST003	FR002	P001	2026-07-01	50000.00	Active	2026-08-16 14:02:12.240377	2026-08-16 14:02:12.240377
\.


--
-- Data for Name: territories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.territories (territory_id, territory_name, region, country, status, created_at, updated_at) FROM stdin;
T001	Mumbai West	West	India	Active	2026-08-16 14:00:53.344519	2026-08-16 14:00:53.344519
T002	Pune	West	India	Active	2026-08-16 14:00:53.344519	2026-08-16 14:00:53.344519
\.


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (doctor_id);


--
-- Name: incentive_payouts incentive_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_payouts
    ADD CONSTRAINT incentive_payouts_pkey PRIMARY KEY (payout_id);


--
-- Name: incentive_programs incentive_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_programs
    ADD CONSTRAINT incentive_programs_pkey PRIMARY KEY (program_id);


--
-- Name: incentive_tiers incentive_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_tiers
    ADD CONSTRAINT incentive_tiers_pkey PRIMARY KEY (tier_id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (prescription_id);


--
-- Name: product_incentive_rates product_incentive_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_incentive_rates
    ADD CONSTRAINT product_incentive_rates_pkey PRIMARY KEY (rate_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (product_id);


--
-- Name: representative_doctor_assignments representative_doctor_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.representative_doctor_assignments
    ADD CONSTRAINT representative_doctor_assignments_pkey PRIMARY KEY (assignment_id);


--
-- Name: representatives representatives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.representatives
    ADD CONSTRAINT representatives_pkey PRIMARY KEY (representative_id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (sale_id);


--
-- Name: sales_targets sales_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT sales_targets_pkey PRIMARY KEY (target_id);


--
-- Name: territories territories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.territories
    ADD CONSTRAINT territories_pkey PRIMARY KEY (territory_id);


--
-- Name: product_incentive_rates uq_program_product_rate; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_incentive_rates
    ADD CONSTRAINT uq_program_product_rate UNIQUE (program_id, product_id);


--
-- Name: incentive_payouts uq_rep_product_program_month; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_payouts
    ADD CONSTRAINT uq_rep_product_program_month UNIQUE (representative_id, product_id, program_id, payout_month);


--
-- Name: sales_targets uq_sales_target; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT uq_sales_target UNIQUE (representative_id, product_id, target_month);


--
-- Name: territories uq_territory_name_country; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.territories
    ADD CONSTRAINT uq_territory_name_country UNIQUE (territory_name, country);


--
-- Name: idx_assignment_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assignment_dates ON public.representative_doctor_assignments USING btree (doctor_id, effective_from, effective_to);


--
-- Name: idx_assignment_doctor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assignment_doctor ON public.representative_doctor_assignments USING btree (doctor_id);


--
-- Name: idx_assignment_representative; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assignment_representative ON public.representative_doctor_assignments USING btree (representative_id);


--
-- Name: idx_doctors_territory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_doctors_territory ON public.doctors USING btree (territory_id);


--
-- Name: idx_payout_month; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payout_month ON public.incentive_payouts USING btree (payout_month);


--
-- Name: idx_payout_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payout_product ON public.incentive_payouts USING btree (product_id);


--
-- Name: idx_payout_representative; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payout_representative ON public.incentive_payouts USING btree (representative_id);


--
-- Name: idx_prescriptions_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescriptions_date ON public.prescriptions USING btree (prescription_date);


--
-- Name: idx_prescriptions_doctor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescriptions_doctor ON public.prescriptions USING btree (doctor_id);


--
-- Name: idx_prescriptions_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_prescriptions_product ON public.prescriptions USING btree (product_id);


--
-- Name: idx_representatives_territory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_representatives_territory ON public.representatives USING btree (territory_id);


--
-- Name: idx_sales_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_date ON public.sales USING btree (sale_date);


--
-- Name: idx_sales_doctor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_doctor ON public.sales USING btree (doctor_id);


--
-- Name: idx_sales_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_product ON public.sales USING btree (product_id);


--
-- Name: idx_sales_selling_territory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_selling_territory ON public.sales USING btree (selling_territory_id);


--
-- Name: idx_sales_targets_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_targets_product ON public.sales_targets USING btree (product_id);


--
-- Name: idx_sales_targets_representative; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_targets_representative ON public.sales_targets USING btree (representative_id);


--
-- Name: representative_doctor_assignments fk_assignment_doctor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.representative_doctor_assignments
    ADD CONSTRAINT fk_assignment_doctor FOREIGN KEY (doctor_id) REFERENCES public.doctors(doctor_id);


--
-- Name: representative_doctor_assignments fk_assignment_representative; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.representative_doctor_assignments
    ADD CONSTRAINT fk_assignment_representative FOREIGN KEY (representative_id) REFERENCES public.representatives(representative_id);


--
-- Name: doctors fk_doctor_territory; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT fk_doctor_territory FOREIGN KEY (territory_id) REFERENCES public.territories(territory_id);


--
-- Name: incentive_payouts fk_payout_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_payouts
    ADD CONSTRAINT fk_payout_product FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- Name: incentive_payouts fk_payout_program; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_payouts
    ADD CONSTRAINT fk_payout_program FOREIGN KEY (program_id) REFERENCES public.incentive_programs(program_id);


--
-- Name: incentive_payouts fk_payout_representative; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_payouts
    ADD CONSTRAINT fk_payout_representative FOREIGN KEY (representative_id) REFERENCES public.representatives(representative_id);


--
-- Name: prescriptions fk_prescription_doctor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT fk_prescription_doctor FOREIGN KEY (doctor_id) REFERENCES public.doctors(doctor_id);


--
-- Name: prescriptions fk_prescription_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT fk_prescription_product FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- Name: product_incentive_rates fk_rate_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_incentive_rates
    ADD CONSTRAINT fk_rate_product FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- Name: product_incentive_rates fk_rate_program; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_incentive_rates
    ADD CONSTRAINT fk_rate_program FOREIGN KEY (program_id) REFERENCES public.incentive_programs(program_id);


--
-- Name: representatives fk_representative_territory; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.representatives
    ADD CONSTRAINT fk_representative_territory FOREIGN KEY (territory_id) REFERENCES public.territories(territory_id);


--
-- Name: sales fk_sale_doctor; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT fk_sale_doctor FOREIGN KEY (doctor_id) REFERENCES public.doctors(doctor_id);


--
-- Name: sales fk_sale_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT fk_sale_product FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- Name: sales fk_sale_territory; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT fk_sale_territory FOREIGN KEY (selling_territory_id) REFERENCES public.territories(territory_id);


--
-- Name: sales_targets fk_sales_target_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT fk_sales_target_product FOREIGN KEY (product_id) REFERENCES public.products(product_id);


--
-- Name: sales_targets fk_sales_target_representative; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_targets
    ADD CONSTRAINT fk_sales_target_representative FOREIGN KEY (representative_id) REFERENCES public.representatives(representative_id);


--
-- Name: incentive_tiers fk_tier_program; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.incentive_tiers
    ADD CONSTRAINT fk_tier_program FOREIGN KEY (program_id) REFERENCES public.incentive_programs(program_id);


--
-- Name: TABLE doctors; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.doctors TO incentive_user;


--
-- Name: TABLE incentive_payouts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.incentive_payouts TO incentive_user;


--
-- Name: TABLE incentive_programs; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.incentive_programs TO incentive_user;


--
-- Name: TABLE incentive_tiers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.incentive_tiers TO incentive_user;


--
-- Name: TABLE prescriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.prescriptions TO incentive_user;


--
-- Name: TABLE product_incentive_rates; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.product_incentive_rates TO incentive_user;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.products TO incentive_user;


--
-- Name: TABLE representative_doctor_assignments; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.representative_doctor_assignments TO incentive_user;


--
-- Name: TABLE representatives; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.representatives TO incentive_user;


--
-- Name: TABLE sales; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales TO incentive_user;


--
-- Name: TABLE sales_targets; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.sales_targets TO incentive_user;


--
-- Name: TABLE territories; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.territories TO incentive_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO incentive_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO incentive_user;


--
-- PostgreSQL database dump complete
--

\unrestrict 0E8oo9QeAETfkOKpd1KeD56vtHyVmjNKoURhhI0jWK3Pjk5F1aoGT5so1daRKrV

